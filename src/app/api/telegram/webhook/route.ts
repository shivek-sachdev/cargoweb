import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateQuotationPDF } from '@/lib/quotation-pdf-server';
import { getQuotationById } from '@/lib/db';

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

/** Create a new quotation (draft) in the database. */
async function toolCreateQuotation(args: {
  customer_name: string;
  destination_country: string;
  destination_port?: string;
  vehicle_type?: string;
  container_size?: string;
  weight?: number;
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

    // Calculate estimated cost if weight is provided
    let totalCost = 0;
    let appliedRate = 0;
    if (args.weight && destinationId) {
      const { data: rates } = await supabase
        .from('freight_rates')
        .select('min_weight, max_weight, base_rate')
        .eq('destination_id', destinationId)
        .order('min_weight', { ascending: true });

      if (rates && rates.length > 0) {
        const weight = args.weight;
        const applicable =
          rates.find((r) => weight >= (r.min_weight ?? 0) && weight <= (r.max_weight ?? Infinity)) ||
          rates[rates.length - 1];
        appliedRate = applicable.base_rate;
        totalCost = Math.round(appliedRate * weight);
      }
    }

    const quotationData = {
      company_id: companyId,
      company_name: args.customer_name,
      customer_name: args.customer_name,
      destination_id: destinationId,
      destination: args.destination_country,
      delivery_service_required: false,
      delivery_vehicle_type: '4wheel',
      additional_charges: [],
      status: 'draft',
      total_cost: totalCost,
      total_freight_cost: totalCost,
      total_actual_weight: args.weight || 0,
      chargeable_weight: args.weight || 0,
      notes: args.notes || `Created via Telegram Bot – ${args.customer_name} to ${args.destination_country}${args.weight ? ` (${args.weight}kg)` : ''}`,
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
        description: 'Create a new cargo shipping quotation draft.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'Name of the shipping company or customer.' },
            destination_country: { type: 'STRING', description: 'Country of destination.' },
            weight: { type: 'NUMBER', description: 'Total weight in kg (optional).' },
            notes: { type: 'STRING', description: 'Any additional shipping notes.' },
          },
          required: ['customer_name', 'destination_country'],
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
You are the OMGEXP Cargo Portal assistant. You help users manage shipping quotations.
- To create a quotation, you need the customer name and destination.
- You can check freight rates for specific countries.
- If a user asks for rates or price, use getFreightRates.
- If the weight is known, always provide a price estimation using getFreightRates.
- If the user confirms they want to proceed with a quotation, use createQuotation.
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
          '_"Create a quotation for Pharma Corp shipping to Switzerland"_\n' +
          '_"Check status of QT-2025-0001"_',
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
