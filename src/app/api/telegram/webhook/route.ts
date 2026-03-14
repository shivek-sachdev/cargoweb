import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateQuotationPDF } from '@/lib/quotation-pdf-server';
import { getQuotationById, updateQuotation } from '@/lib/db';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ────────────────────────────────────────────────────────────
//  Telegram helpers
// ────────────────────────────────────────────────────────────

async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode?: string,
  disablePreview = false
) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        link_preview_options: disablePreview ? { is_disabled: true } : undefined,
      }),
    });
    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

async function sendTelegramDocument(chatId: number, fileBuffer: Buffer, fileName: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`;
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([new Uint8Array(fileBuffer)]), fileName);
  if (caption) formData.append('caption', caption);
  try {
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) {
      console.error('Failed to send Telegram document:', await response.text());
    }
  } catch (err) {
    console.error('Error sending Telegram document:', err);
  }
}

// ────────────────────────────────────────────────────────────
//  AI Tool definitions – these are callable by Gemini
// ────────────────────────────────────────────────────────────

/** Parse pallet dimensions from natural language e.g. "80x120x154" or "80 x 120 x 154" */
function parsePalletDimensions(input?: string): { length: number; width: number; height: number } | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(/(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/);
  if (match) {
    return { length: parseInt(match[1], 10), width: parseInt(match[2], 10), height: parseInt(match[3], 10) };
  }
  return null;
}

/** Create a new quotation (draft) in the database. */
async function toolCreateQuotation(args: {
  customer_name: string;
  destination_country: string;
  destination_port?: string;
  vehicle_type?: string;
  container_size?: string;
  weight?: number;
  pallet_dimensions?: string;
  pallet_quantity?: number;
  rate_per_kg?: number;
  notes?: string;
}, chatId?: number) {
  try {
    // Find or create company
    let companyId: string | null = null;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', args.customer_name)
      .limit(1)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany } = await supabase
        .from('companies')
        .insert({ name: args.customer_name })
        .select('id')
        .single();
      companyId = newCompany?.id ?? null;
    }

    // Find destination
    let destinationId: string | null = null;
    const { data: dest } = await supabase
      .from('destinations')
      .select('id')
      .ilike('country', `%${args.destination_country}%`)
      .limit(1)
      .single();
    if (dest) destinationId = dest.id;

    // Parse pallet dimensions if provided (e.g. "80x120x154")
    const palletDims = parsePalletDimensions(args.pallet_dimensions);
    const qty = args.pallet_quantity ?? 1;
    const actualWeight = args.weight || 0;
    let volumeWeight = 0;
    if (palletDims) {
      volumeWeight = (palletDims.length * palletDims.width * palletDims.height * qty) / 6000;
    }
    const chargeableWeight = Math.max(actualWeight, volumeWeight) || actualWeight;

    // Calculate estimated cost - use rate_per_kg if provided, else lookup from freight_rates
    let totalCost = 0;
    let appliedRate = args.rate_per_kg ?? 0;
    if (chargeableWeight && destinationId && !args.rate_per_kg) {
      const { data: rates } = await supabase
        .from('freight_rates')
        .select('min_weight, max_weight, base_rate')
        .eq('destination_id', destinationId)
        .order('min_weight', { ascending: true });

      if (rates && rates.length > 0) {
        const applicable =
          rates.find((r) => chargeableWeight >= (r.min_weight ?? 0) && chargeableWeight <= (r.max_weight ?? Infinity)) ||
          rates[rates.length - 1];
        appliedRate = applicable.base_rate;
      }
    }
    if (chargeableWeight && appliedRate) {
      totalCost = Math.round(appliedRate * chargeableWeight);
    }

    const pallets = palletDims
      ? [{ length: palletDims.length, width: palletDims.width, height: palletDims.height, weight: actualWeight / qty || 0, quantity: qty }]
      : (actualWeight ? [{ length: 0, width: 0, height: 0, weight: actualWeight, quantity: 1 }] : [{ length: 0, width: 0, height: 0, weight: 0, quantity: 1 }]);

    const quotationData = {
      company_id: companyId,
      company_name: args.customer_name,
      customer_name: args.customer_name,
      destination_id: destinationId,
      destination: args.destination_country,
      delivery_service_required: false,
      delivery_vehicle_type: '4wheel',
      additional_charges: [],
      pallets,
      status: 'draft',
      total_cost: totalCost,
      total_freight_cost: totalCost,
      total_actual_weight: actualWeight,
      total_volume_weight: volumeWeight,
      chargeable_weight: chargeableWeight,
      notes: args.notes || `Created via Telegram Bot – ${args.customer_name} to ${args.destination_country}${chargeableWeight ? ` (${chargeableWeight}kg)` : ''}`,
    };

    const { data: savedQuotation, error: insertError } = await supabase
      .from('quotations')
      .insert(quotationData)
      .select()
      .single();

    if (insertError) throw insertError;

    // --- AUTOMATED PDF GENERATION & DELIVERY ---
    if (chatId && savedQuotation) {
      try {
        console.log(`📄 Generating PDF for quotation ${savedQuotation.id}...`);
        // Fetch full data using getQuotationById to get company/destination names for PDF
        const fullQuotationData = await getQuotationById(savedQuotation.id);
        if (fullQuotationData) {
          const pdfBuffer = await generateQuotationPDF(fullQuotationData);
          const fileName = `Quotation_${fullQuotationData.quotation_no || savedQuotation.id}.pdf`;
          await sendTelegramDocument(
            chatId, 
            pdfBuffer, 
            fileName, 
            `📄 Here is your official quotation document for ${args.customer_name}.`
          );
        }
      } catch (pdfErr) {
        console.error('Error in automated PDF delivery:', pdfErr);
        // Don't fail the whole tool call if PDF fails, but notify user
        if (chatId) {
          await sendTelegramMessage(chatId, '⚠️ Quotation created, but I had trouble generating the PDF document. You can still view it in the portal.');
        }
      }
    }

    return {
      success: true,
      quotation_id: savedQuotation.id,
      quotation_no: savedQuotation.quotation_no,
      total_cost: totalCost,
      message: `Quotation created successfully! ${chatId ? 'I have sent the PDF document to your chat.' : ''}`,
    };
  } catch (error: unknown) {
    console.error('Error in toolCreateQuotation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { error: errorMessage };
  }
}

/** Check document status/onboarding progress. */
async function toolCheckStatus(args: { quotation_no: string }) {
  const { data: quote } = await supabase
    .from('quotations')
    .select('id, status, quotation_no, customer_name, destination')
    .ilike('quotation_no', args.quotation_no)
    .limit(1)
    .single();

  if (!quote) return { error: `Quotation ${args.quotation_no} not found.` };

  // Count uploaded docs
  const { count: docCount } = await supabase
    .from('document_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('quotation_id', quote.id);

  return {
    quotation_no: quote.quotation_no,
    customer: quote.customer_name,
    destination: quote.destination,
    status: quote.status,
    documents_uploaded: docCount || 0,
  };
}

/** List recent quotations. */
async function toolListQuotations(args: { limit?: number }) {
  const { data } = await supabase
    .from('quotations')
    .select('quotation_no, customer_name, destination, status, total_cost')
    .order('created_at', { ascending: false })
    .limit(args.limit || 5);

  return { quotations: data || [] };
}

/** Update quotation rate or other fields. */
async function toolUpdateQuotation(args: {
  quotation_no?: string;
  quotation_id?: string;
  new_rate_per_kg?: number;
  total_cost?: number;
}, chatId?: number) {
  try {
    let quote: { id: string; quotation_no: string; chargeable_weight: number; total_cost: number } | null = null;
    if (args.quotation_id) {
      const { data } = await supabase.from('quotations').select('id, quotation_no, chargeable_weight, total_cost').eq('id', args.quotation_id).single();
      quote = data;
    } else if (args.quotation_no) {
      const { data } = await supabase.from('quotations').select('id, quotation_no, chargeable_weight, total_cost').ilike('quotation_no', args.quotation_no).limit(1).single();
      quote = data;
    }
    if (!quote) return { error: 'Quotation not found.' };

    const updates: Record<string, unknown> = {};
    if (args.new_rate_per_kg != null && quote.chargeable_weight) {
      const newTotal = Math.round(args.new_rate_per_kg * quote.chargeable_weight);
      updates.total_freight_cost = newTotal;
      updates.total_cost = newTotal;
    }
    if (args.total_cost != null) {
      updates.total_cost = args.total_cost;
      updates.total_freight_cost = args.total_cost;
    }
    if (Object.keys(updates).length === 0) return { error: 'No updates provided.' };

    const updated = await updateQuotation(quote.id, updates as Parameters<typeof updateQuotation>[1]);
    if (!updated) return { error: 'Failed to update quotation.' };

    if (chatId) {
      const full = await getQuotationById(quote.id);
      if (full) {
        const pdfBuffer = await generateQuotationPDF(full);
        await sendTelegramDocument(chatId, pdfBuffer, `Quotation_${full.quotation_no || quote.id}.pdf`, 'Updated quotation PDF.');
      }
    }
    return { success: true, quotation_no: quote.quotation_no, message: 'Quotation updated. PDF sent.' };
  } catch (e) {
    console.error('toolUpdateQuotation:', e);
    return { error: e instanceof Error ? e.message : 'Update failed.' };
  }
}

/** Send quotation PDF to chat. */
async function toolGetQuotationPDF(args: { quotation_no?: string; quotation_id?: string }, chatId?: number) {
  try {
    let quote: { id: string; quotation_no: string } | null = null;
    if (args.quotation_id) {
      const { data } = await supabase.from('quotations').select('id, quotation_no').eq('id', args.quotation_id).single();
      quote = data;
    } else if (args.quotation_no) {
      const { data } = await supabase.from('quotations').select('id, quotation_no').ilike('quotation_no', args.quotation_no).limit(1).single();
      quote = data;
    }
    if (!quote || !chatId) return { error: 'Quotation not found or chat not available.' };

    const full = await getQuotationById(quote.id);
    if (!full) return { error: 'Could not load quotation data.' };
    const pdfBuffer = await generateQuotationPDF(full);
    await sendTelegramDocument(chatId, pdfBuffer, `Quotation_${full.quotation_no || quote.id}.pdf`, 'Here is your quotation PDF.');
    return { success: true, message: 'PDF sent.' };
  } catch (e) {
    console.error('toolGetQuotationPDF:', e);
    return { error: e instanceof Error ? e.message : 'Failed to generate PDF.' };
  }
}

/** List customers (companies). */
async function toolListCustomers(args: { limit?: number }) {
  const { data } = await supabase
    .from('companies')
    .select('id, name')
    .order('name')
    .limit(args.limit || 20);
  return { customers: data || [] };
}

/** List quotations for a customer. */
async function toolGetCustomerQuotations(args: { customer_name: string; limit?: number }) {
  const { data } = await supabase
    .from('quotations')
    .select('id, quotation_no, customer_name, destination, status, total_cost')
    .ilike('company_name', `%${args.customer_name}%`)
    .order('created_at', { ascending: false })
    .limit(args.limit || 10);
  return { quotations: data || [] };
}

/** Get freight rates for a destination. */
async function toolGetRates(args: { destination: string; weight?: number }) {
  // Find destination first
  const { data: dest } = await supabase
    .from('destinations')
    .select('id, country, port')
    .ilike('country', `%${args.destination}%`)
    .limit(1)
    .single();

  if (!dest) {
    return { error: `No rates found for destination "${args.destination}".` };
  }

  // Get rates for this destination
  const { data: rates } = await supabase
    .from('freight_rates')
    .select('min_weight, max_weight, base_rate')
    .eq('destination_id', dest.id)
    .order('min_weight', { ascending: true });

  if (!rates || rates.length === 0) {
    return { error: `No specific rates found for ${dest.country}.` };
  }

  let estimate = null;
  if (args.weight) {
    const weight = args.weight;
    const applicable =
      rates.find((r) => weight >= (r.min_weight ?? 0) && weight <= (r.max_weight ?? Infinity)) ||
      rates[rates.length - 1];
    estimate = {
      weight,
      rate_applied: applicable.base_rate,
      estimated_total: Math.round(applicable.base_rate * weight),
    };
  }

  return {
    destination: `${dest.country}${dest.port ? ` (${dest.port})` : ''}`,
    available_rates: rates,
    estimate,
  };
}

// ────────────────────────────────────────────────────────────
//  GEMINI CONFIG
// ────────────────────────────────────────────────────────────

const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'createQuotation',
        description: 'Create a new cargo shipping quotation. Supports pallet dimensions (e.g. 80x120x154 cm), weight, and standard freight rates. Example: "Create quotation for Customer X to Zurich, pallet 80x120x154, standard rate"',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'Name of the shipping company or customer.' },
            destination_country: { type: 'STRING', description: 'Country of destination (e.g. Switzerland, Zurich).' },
            weight: { type: 'NUMBER', description: 'Total weight in kg (optional).' },
            pallet_dimensions: { type: 'STRING', description: 'Pallet dimensions as LxWxH in cm, e.g. "80x120x154".' },
            pallet_quantity: { type: 'NUMBER', description: 'Number of pallets (default 1).' },
            rate_per_kg: { type: 'NUMBER', description: 'Override freight rate per kg if user specifies (e.g. 315).' },
            notes: { type: 'STRING', description: 'Any additional shipping notes.' },
          },
          required: ['customer_name', 'destination_country'],
        },
      },
      {
        name: 'updateQuotation',
        description: 'Update an existing quotation, e.g. change the rate. Example: "Change the rate from 300 to 315" or "Update quotation Q-001 rate to 315".',
        parameters: {
          type: 'OBJECT',
          properties: {
            quotation_no: { type: 'STRING', description: 'Quotation number (e.g. QT-2025-0001).' },
            quotation_id: { type: 'STRING', description: 'Quotation UUID if known.' },
            new_rate_per_kg: { type: 'NUMBER', description: 'New freight rate per kg.' },
            total_cost: { type: 'NUMBER', description: 'New total cost (alternative to rate).' },
          },
        },
      },
      {
        name: 'getQuotationPDF',
        description: 'Generate and send the quotation PDF to the user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            quotation_no: { type: 'STRING', description: 'Quotation number.' },
            quotation_id: { type: 'STRING', description: 'Quotation UUID.' },
          },
        },
      },
      {
        name: 'listCustomers',
        description: 'List all customers/companies.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'NUMBER', description: 'Max number to return (default 20).' },
          },
        },
      },
      {
        name: 'getCustomerQuotations',
        description: 'List quotations for a specific customer.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'Customer or company name.' },
            limit: { type: 'NUMBER', description: 'Max number (default 10).' },
          },
          required: ['customer_name'],
        },
      },
      {
        name: 'checkStatus',
        description: 'Check the status and document progress of a specific quotation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            quotation_no: { type: 'STRING', description: 'The quotation number (e.g. QT-2025-0001).' },
          },
          required: ['quotation_no'],
        },
      },
      {
        name: 'listQuotations',
        description: 'List the most recent shipping quotations.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'NUMBER', description: 'Number of quotations to list (default 5).' },
          },
        },
      },
      {
        name: 'getFreightRates',
        description: 'Get freight rates and cost estimation for a specific destination.',
        parameters: {
          type: 'OBJECT',
          properties: {
            destination: { type: 'STRING', description: 'Destination country.' },
            weight: { type: 'NUMBER', description: 'Weight in kg for cost estimation.' },
          },
          required: ['destination'],
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `
You are the OMGEXP Cargo Portal assistant. You help users manage shipping quotations via natural language.
- Create quotation: "Create a quotation for Customer X, for Zurich using standard rate, pallet size is 80 x 120 x 154" - use createQuotation with customer_name, destination_country, and pallet_dimensions "80x120x154".
- Update rate: "Change the rate from 300 to 315" - use updateQuotation with new_rate_per_kg: 315 (identify the quotation from context or ask).
- Send PDF: "Send me the PDF for Q-001" - use getQuotationPDF.
- List customers: use listCustomers.
- Customer quotations: "Show quotations for Customer X" - use getCustomerQuotations.
- Always generate and send the PDF after creating or updating a quotation when the user is in a chat.
- Parse pallet dimensions from formats like "80x120x154", "80 x 120 x 154", "80×120×154".
- Be professional, concise, and helpful.
`;

// ────────────────────────────────────────────────────────────
//  Conversation memory (in-memory for demo; use DB in prod)
// ────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

const conversationStore = new Map<number, ChatMessage[]>();
const MAX_HISTORY = 20; // keep last N messages per chat

// ────────────────────────────────────────────────────────────
//  POST handler
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!TELEGRAM_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const payload = await request.json();
    const { message } = payload;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId: number = message.chat.id;
    const text: string = message.text.trim();

    // ── Fast-path for /start ──
    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        '👋 Welcome to the *OMGEXP Cargo Portal Bot*!\n\n' +
          'I can help you:\n' +
          '• Create new quotations\n' +
          '• Check shipment document status\n' +
          '• List recent quotations\n\n' +
          'Just type naturally — for example:\n' +
          '_"Create a quotation for Customer X to Zurich, pallet 80x120x154, standard rate"_\n' +
          '_"Change the rate from 300 to 315"_\n' +
          '_"Send me the PDF for QT-2025-0001"_',
        'Markdown'
      );
      return NextResponse.json({ ok: true });
    }

    // ── Get Gemini API key ──
    let apiKey = process.env.GEMINI_API_KEY || '';

    // Try from DB as fallback
    if (!apiKey) {
      const { data: settingData } = await supabase
        .from('settings')
        .select('settings_value')
        .eq('category', 'ai')
        .eq('settings_key', 'gemini_api_key')
        .limit(1)
        .single();
      if (settingData?.settings_value) {
        apiKey =
          typeof settingData.settings_value === 'string'
            ? settingData.settings_value
            : (settingData.settings_value as Record<string, string>)?.value || '';
      }
    }

    if (!apiKey) {
      await sendTelegramMessage(
        chatId,
        '⚠️ AI is not configured yet. Please set GEMINI_API_KEY in the environment or in Settings > AI Settings.'
      );
      return NextResponse.json({ ok: true });
    }

    // ── Build conversation history ──
    const history = conversationStore.get(chatId) || [];
    history.push({ role: 'user', parts: [{ text }] });

    // ── Call Gemini with function-calling ──
    const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // Build tools with proper SchemaType enum values
    const tools = [
      {
        functionDeclarations: AI_TOOLS[0].functionDeclarations.map((fn) => ({
          ...fn,
          parameters: fn.parameters
            ? {
                ...fn.parameters,
                type: SchemaType.OBJECT,
                properties: Object.fromEntries(
                  Object.entries(fn.parameters.properties).map(([k, v]) => [
                    k,
                    { ...v, type: v.type === 'NUMBER' ? SchemaType.NUMBER : SchemaType.STRING },
                  ])
                ),
              }
            : undefined,
        })),
      },
    ];

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools,
    });

    const chat = model.startChat({ history: history.slice(-MAX_HISTORY) });
    let result = await chat.sendMessage(text);
    let response = result.response;

    // ── Handle function calls (loop until the model produces text) ──
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.functionCalls() && response.functionCalls()!.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const functionCalls = response.functionCalls()!;
      const functionResponses = [];

      for (const call of functionCalls) {
        console.log(`🤖 Telegram AI calling tool: ${call.name}`, call.args);

        let toolResult: unknown;
        switch (call.name) {
          case 'createQuotation':
            toolResult = await toolCreateQuotation(call.args as Parameters<typeof toolCreateQuotation>[0], chatId);
            break;
          case 'updateQuotation':
            toolResult = await toolUpdateQuotation(call.args as Parameters<typeof toolUpdateQuotation>[0], chatId);
            break;
          case 'getQuotationPDF':
            toolResult = await toolGetQuotationPDF(call.args as Parameters<typeof toolGetQuotationPDF>[0], chatId);
            break;
          case 'listCustomers':
            toolResult = await toolListCustomers(call.args as Parameters<typeof toolListCustomers>[0]);
            break;
          case 'getCustomerQuotations':
            toolResult = await toolGetCustomerQuotations(call.args as Parameters<typeof toolGetCustomerQuotations>[0]);
            break;
          case 'checkStatus':
            toolResult = await toolCheckStatus(call.args as Parameters<typeof toolCheckStatus>[0]);
            break;
          case 'listQuotations':
            toolResult = await toolListQuotations(call.args as Parameters<typeof toolListQuotations>[0]);
            break;
          case 'getFreightRates':
            toolResult = await toolGetRates(call.args as Parameters<typeof toolGetRates>[0]);
            break;
          default:
            toolResult = { error: `Unknown function: ${call.name}` };
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: toolResult as object,
          },
        });
      }

      // Send tool results back to the model — cast to Part[] for type safety
      result = await chat.sendMessage(
        functionResponses as unknown as import('@google/generative-ai').Part[]
      );
      response = result.response;
    }

    // ── Extract final text and send to Telegram ──
    const replyText = response.text() || 'Sorry, I could not process that request.';

    // Update conversation memory
    history.push({ role: 'model', parts: [{ text: replyText }] });
    // Trim to keep memory bounded
    if (history.length > MAX_HISTORY * 2) {
      conversationStore.set(chatId, history.slice(-MAX_HISTORY));
    } else {
      conversationStore.set(chatId, history);
    }

    await sendTelegramMessage(chatId, replyText, 'Markdown', true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
