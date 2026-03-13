import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFileUrl } from '@/lib/storage';

// Increase timeout for AI processing (max 300s for Pro plan, 60s for Hobby)
export const maxDuration = 60; // 60 seconds
export const dynamic = 'force-dynamic';

// Simple rate limiting - global store for demo (in production, use Redis/database)
const rateLimitStore = new Map<string, number>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds between requests per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userKey = `user_${userId}`;

  const lastRequestTime = rateLimitStore.get(userKey);
  if (!lastRequestTime) {
    rateLimitStore.set(userKey, now);
    return true;
  }

  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_WINDOW) {
    return false;
  }

  rateLimitStore.set(userKey, now);
  return true;
}

// Interface for document object
interface DocumentData {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  file_path?: string;
  storage_provider?: 'supabase' | 'r2';
  base64Data?: string;
  mimeType?: string;
}

// Interface for uploaded document from Document Comparison System
interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  base64Data: string;
  mimeType: string;
}

// Interface for extracted document data
interface ExtractedData {
  consignor_name?: string;
  consignor_address?: string;
  consignee_name?: string;
  consignee_address?: string;
  hs_code?: string;
  permit_number?: string;
  po_number?: string;
  country_of_origin?: string;
  country_of_destination?: string;
  quantity?: string;
  total_value?: string;
  shipping_marks?: string;
  shipped_from?: string;
  shipped_to?: string;
  document_date?: string;
}

// Type guard for error objects
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function isErrorWithStatus(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

// Helper function to implement exponential backoff retry
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const isRetryableError =
        (isErrorWithMessage(error) && (
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('quota') ||
          error.message.includes('rate_limit') ||
          error.message.includes('429')
        )) ||
        (isErrorWithStatus(error) && (
          error.status === 429 ||
          error.status === 503
        ));

      if (!isRetryableError || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
      console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Helper function to download file from URL and convert to base64
// Supports both regular URLs and data URLs
async function downloadAndConvertToBase64(url: string): Promise<string> {
  try {
    // Check if it's a data URL
    if (url.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Data = url.split(',')[1];
      if (base64Data) {
        return base64Data;
      }
      throw new Error('Invalid data URL format');
    }

    // Regular URL download
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Helper function to get MIME type from file extension
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/pdf';
}

export async function POST(request: Request) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error. Please contact administrator.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      document_ids,
      quotation_id,
      user_id,
      rule_id,
      analysis_mode = 'quotation',
      document_urls,
      documents  // New parameter for uploaded mode with file data
    } = body;

    console.log('Document comparison request:', {
      analysis_mode,
      document_ids_count: document_ids?.length,
      document_urls_count: document_urls?.length,
      quotation_id,
      user_id,
      rule_id
    });

    // Validate based on analysis mode
    if (analysis_mode === 'uploaded') {
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return NextResponse.json(
          { error: 'documents array is required for uploaded mode' },
          { status: 400 }
        );
      }
      if (!quotation_id) {
        return NextResponse.json(
          { error: 'quotation_id is required for uploaded mode' },
          { status: 400 }
        );
      }
    } else if (analysis_mode === 'quotation') {
      if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
        return NextResponse.json(
          { error: 'document_ids array is required for quotation mode' },
          { status: 400 }
        );
      }
      if (!quotation_id) {
        return NextResponse.json(
          { error: 'quotation_id is required for quotation mode' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid analysis_mode. Must be 'quotation' or 'uploaded'" },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    if (!rule_id) {
      return NextResponse.json(
        { error: 'rule_id is required' },
        { status: 400 }
      );
    }

    // Check rate limiting
    if (!checkRateLimit(user_id)) {
      console.log(`🚫 Rate limit exceeded for user ${user_id}`);
      return NextResponse.json(
        {
          error: 'Too many requests. Please wait a few seconds before trying again.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
          }
        }
      );
    }

    // Use Service Role Key to access settings
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    // Get comparison rule from database
    console.log('🔍 Fetching rule from DB with ID:', rule_id);
    const { data: rule, error: ruleError } = await supabase
      .from('document_comparison_rules')
      .select('*')
      .eq('id', rule_id)
      .single();

    if (ruleError || !rule) {
      console.error('❌ Rule fetch error:', ruleError);
      return NextResponse.json(
        { error: 'Comparison rule not found' },
        { status: 404 }
      );
    }

    console.log('✅ Using rule:', rule.name);
    console.log('📝 Rule ID:', rule.id);
    console.log('📏 Instructions length from DB:', rule.comparison_instructions?.length || 0);
    console.log('📄 Instructions preview (first 300 chars):', rule.comparison_instructions?.substring(0, 300));
    console.log('📄 Instructions end (last 300 chars):', rule.comparison_instructions?.substring(Math.max(0, (rule.comparison_instructions?.length || 0) - 300)));

    // Get Gemini API key from settings table
    const { data: settingData } = await supabase
      .from('settings')
      .select('settings_value')
      .eq('user_id', user_id)
      .eq('category', 'ai')
      .eq('settings_key', 'gemini_api_key')
      .single();

    // settings_value can be JSONB or string
    let apiKey = settingData?.settings_value;
    if (typeof apiKey !== 'string') {
      apiKey = (apiKey as Record<string, unknown>)?.value as string || '';
    }

    // Fallback to env variable if not in settings
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || '';
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please set your API key in Settings > AI Settings.' },
        { status: 500 }
      );
    }

    // Get documents based on analysis mode
    let documentList;

    if (analysis_mode === 'uploaded') {
      // 📁 UPLOADED MODE: Use documents data sent directly
      console.log('📁 Using uploaded mode - processing documents from request data');

      // Convert the received documents to the format expected by the processing logic
      documentList = documents.map((doc: UploadedDocument, index: number) => ({
        id: doc.id || `uploaded_${index}`,
        file_name: doc.name,
        file_url: `data:${doc.mimeType};base64,${doc.base64Data}`, // Create data URL for processing
        document_type: doc.type || 'other',
        // Store base64 data for later use
        base64Data: doc.base64Data,
        mimeType: doc.mimeType,
      }));

      console.log(`✓ Prepared ${documentList.length} documents for uploaded analysis`);

    } else {
      // 📋 ORIGINAL QUOTATION MODE: Get documents from database
      console.log('📋 Using quotation mode - fetching from database');

      const { data: docs, error: documentsError } = await supabase
        .from('document_submissions')
        .select('*')
        .in('id', document_ids)
        .eq('quotation_id', quotation_id);

      if (documentsError || !docs || docs.length === 0) {
        return NextResponse.json(
          { error: 'Failed to fetch documents from database' },
          { status: 404 }
        );
      }

      documentList = docs;
      console.log(`✓ Fetched ${documentList.length} documents from database`);
    }

    // Initialize Google GenAI client
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // Phase 1: Download files and convert to base64, then extract key fields (PARALLEL)
    console.log('Phase 1: Downloading files and extracting data in parallel...');
    console.time('Phase 1');

    const extractedMap: Record<string, ExtractedData> = {};
    const documentsWithData: Array<{
      id: string;
      name: string;
      type: string;
      base64Data: string;
      mimeType: string;
    }> = [];

    // Process all documents in parallel for faster processing
    const processPromises = documentList.map(async (doc: DocumentData) => {
      try {
        console.log(`Processing file: ${doc.file_name}`);

        // For uploaded mode, use existing base64Data; for quotation mode, download
        let base64Data: string;
        let mimeType: string;

        if (analysis_mode === 'uploaded' && doc.base64Data) {
          // Use existing base64 data for uploaded mode
          base64Data = doc.base64Data;
          mimeType = doc.mimeType || getMimeType(doc.file_name);
          console.log(`Using existing base64 data for ${doc.file_name}`);
        } else {
          // Resolve URL for R2 if needed
          // file_url may contain a raw R2 path (not a URL) — must resolve it
          let effectiveUrl = doc.file_url;
          const needsResolve = !effectiveUrl || effectiveUrl === '' || !effectiveUrl.startsWith('http');
          if (needsResolve && (doc.file_path || doc.file_url)) {
            const pathToResolve = doc.file_path || doc.file_url;
            console.log(`Resolving storage URL for path: ${pathToResolve} (provider: ${doc.storage_provider || 'r2'})`);
            effectiveUrl = await getFileUrl(pathToResolve, doc.storage_provider || 'r2', 'documents');
          }

          if (!effectiveUrl) {
            throw new Error(`No URL available for document: ${doc.file_name}`);
          }

          // Download for quotation mode or fallback
          base64Data = await downloadAndConvertToBase64(effectiveUrl);
          mimeType = getMimeType(doc.file_name);
          console.log(`Downloaded file: ${doc.file_name} from ${effectiveUrl.substring(0, 50)}...`);
        }

        const docData = {
          id: doc.id,
          name: doc.file_name || doc.document_type,
          type: doc.document_type,
          base64Data,
          mimeType,
        };

        // Extract fields from this document using rule's extraction fields
        const extractionFields = rule.extraction_fields || [];
        const fieldsTemplate = extractionFields.reduce((acc: Record<string, string>, field: string) => {
          acc[field] = "";
          return acc;
        }, {});

        const extractPrompt = `Extract the following fields from this document section called "${doc.file_name || doc.document_type}".
Return STRICT JSON only (no prose) with keys (use empty string or null if not present):
${JSON.stringify(fieldsTemplate, null, 2)}`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const extraction = await retryWithBackoff(
          () => model.generateContent([
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            extractPrompt,
          ]),
          3, // max retries
          2000 // base delay 2 seconds
        );

        let extracted: ExtractedData = {};
        try {
          const responseText = extraction.response.text();
          extracted = JSON.parse(responseText || '{}') as ExtractedData;
        } catch {
          extracted = {};
        }

        console.log(`✓ Extracted data from ${doc.file_name}`);
        return { docData, extracted };
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        return {
          docData: {
            id: doc.id,
            name: doc.file_name || doc.document_type,
            type: doc.document_type,
            base64Data: '',
            mimeType: 'application/pdf',
          },
          extracted: {}
        };
      }
    });

    // Wait for all documents to be processed
    const results = await Promise.all(processPromises);

    // Populate arrays from results
    results.forEach(({ docData, extracted }) => {
      if (docData.base64Data) {
        documentsWithData.push(docData);
        extractedMap[docData.id] = extracted;
      }
    });

    console.timeEnd('Phase 1');
    console.log(`✓ Processed ${documentsWithData.length} documents`);

    // Phase 2: Generate comprehensive cross-document comparison
    // EXACT LOGIC from ai-doc-review-main - DO NOT MODIFY
    console.log('Phase 2: Performing cross-document analysis...');

    // Helper function to convert document_type slug to display name
    function getDocumentTypeDisplayName(slug: string): string {
      const typeMap: Record<string, string> = {
        'commercial-invoice': 'Commercial Invoice',
        'packing-list': 'Packing List',
        'tk-31': 'TK-31 Export Report',
        'tk-10-eng': 'TK-10 Export Permit (ENG)',
        'tk-11-eng': 'TK-11 Export Report (ENG)',
        'tk-31-eng': 'TK-31 Export Report (ENG)',
        'tk-32': 'TK-32 Export Permit',
        'import-permit': 'Import Permit',
        'export-permit': 'Export Permit',
        'hemp-letter': 'Hemp Certification Letter',
        'bill-of-lading': 'Bill of Lading',
        'certificate-of-origin': 'Certificate of Origin',
        'other': 'Other Document'
      };
      return typeMap[slug] || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    try {
      // Build list of all documents with their extracted data
      const allDocuments = documentsWithData.map(doc => ({
        id: doc.id,
        file_name: doc.name,
        document_type: getDocumentTypeDisplayName(doc.type), // Use display name
        document_type_slug: doc.type, // Keep slug for reference
        extracted: extractedMap[doc.id] || {}
      }));

      // Use rule's comparison instructions
      // Replace placeholders with actual data - use document_type for section headers
      let comparisonPrompt = rule.comparison_instructions
        .replace(/\{allDocuments\}/g, JSON.stringify(allDocuments, null, 2))
        .replace(/\{documentCount\}/g, allDocuments.length.toString())
        .replace(/\{documentList\}/g, allDocuments.map(d => `- ${d.document_type}`).join('\n'))
        .replace(/\{firstDocumentName\}/g, allDocuments[0]?.document_type || 'Document Name');

      // Add critical checks evaluation if available
      const criticalChecks = rule.critical_checks || [];
      if (criticalChecks.length > 0) {
        comparisonPrompt += `\n\n---\n\nCRITICAL CHECKS EVALUATION:\n\n`;
        comparisonPrompt += `You MUST evaluate each of the following critical checks and provide structured feedback.\n\n`;
        comparisonPrompt += `For EACH check below, you MUST include a dedicated section in your response:\n\n`;

        criticalChecks.forEach((check: string, index: number) => {
          comparisonPrompt += `${index + 1}. ${check}\n`;
        });

        comparisonPrompt += `\n\nFor each critical check, you MUST create a section like this:\n\n`;
        comparisonPrompt += `### Critical Check: [Check Name]\n`;
        comparisonPrompt += `**Status:** PASS | FAIL | WARNING\n`;
        comparisonPrompt += `**Details:** [Provide specific values from each document]\n`;
        comparisonPrompt += `**Issue:** [If FAIL or WARNING, explain what's wrong]\n\n`;
        comparisonPrompt += `Example:\n`;
        comparisonPrompt += `### Critical Check: Net Weight must match across documents\n`;
        comparisonPrompt += `**Status:** FAIL\n`;
        comparisonPrompt += `**Details:** TK32: 500,000g, Packing List: 471,000g, Invoice: 471,000g\n`;
        comparisonPrompt += `**Issue:** Net weight in Packing List and Invoice (471kg) does not match TK32 (500kg). Discrepancy of 29kg.\n\n`;
      }

      // DEBUG: Log the full prompt being sent to AI
      console.log('=== FULL PROMPT SENT TO AI (Optimized - no base64 re-send) ===');
      console.log('Prompt length:', comparisonPrompt.length);
      console.log('Critical checks count:', criticalChecks.length);
      console.log('=== END PROMPT ===');

      // OPTIMIZED: Send only extracted structured data, NOT raw base64 files
      // Phase 1 already extracted all relevant fields from the documents.
      // Re-sending multi-megabyte base64 blobs wastes tokens and causes timeouts.
      const contextSummary = `\n\n--- EXTRACTED DATA FROM ALL DOCUMENTS ---\n${JSON.stringify(allDocuments, null, 2)}\n--- END EXTRACTED DATA ---`;

      const fullPrompt = comparisonPrompt + contextSummary;

      // Generate comprehensive review with retry logic
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const response = await retryWithBackoff(
        () => model.generateContent(fullPrompt),
        3, // max retries
        3000 // base delay 3 seconds (longer for complex requests)
      );
      const fullFeedback = response.response.text();

      console.log('Full AI Feedback Length:', fullFeedback.length);
      console.log('Full AI Feedback Preview:', fullFeedback.substring(0, 500));

      // Extract all ## sections from AI response for debugging
      const allSections = fullFeedback.match(/##\s+[^\n]+/g) || [];
      console.log('All ## sections found in AI response:', allSections);
      console.log('Document types we are looking for:', documentsWithData.map(d => getDocumentTypeDisplayName(d.type)));

      // Parse the response to extract per-document sections BY DOCUMENT TYPE
      const documentSections: Record<string, string> = {};

      for (const doc of documentsWithData) {
        // Match by document_type display name (e.g., "Commercial Invoice", "Packing List")
        let match = null;
        const displayType = getDocumentTypeDisplayName(doc.type);

        // Strategy 1: Match by display type exactly
        const escapedType = displayType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex1 = new RegExp(`##\\s*(?:\\[)?${escapedType}(?:\\])?[\\s\\S]*?(?=(?:\\n##\\s+(?!#))|$)`, 'i');
        match = fullFeedback.match(regex1);

        // Strategy 2: Flexible match - find any section containing the document type
        if (!match) {
          const regex2 = new RegExp(`##\\s*[^\\n]*${escapedType}[^\\n]*[\\s\\S]*?(?=(?:\\n##\\s+(?!#))|$)`, 'i');
          match = fullFeedback.match(regex2);
        }

        // Strategy 3: Match by keywords in document type
        if (!match) {
          const keywords = displayType.split(/\s+/).filter(k => k.length > 2);
          if (keywords.length > 0) {
            const keywordPattern = keywords.join('.*');
            const regex3 = new RegExp(`##\\s*[^\\n]*${keywordPattern}[^\\n]*[\\s\\S]*?(?=(?:\\n##\\s+(?!#))|$)`, 'i');
            match = fullFeedback.match(regex3);
          }
        }

        if (match) {
          documentSections[doc.id] = match[0];
          console.log(`✓ Successfully extracted section for ${displayType} (${doc.name}), length: ${match[0].length}`);
        } else {
          console.log(`✗ Failed to extract section for ${displayType} (${doc.name}), using fallback`);
          // If we can't find a section, create a note
          documentSections[doc.id] = `## ${displayType}\n\n### ⚠️ Warnings & Recommendations\n- No specific feedback generated for this document type in the review.\n- File: ${doc.name}`;
        }
      }

      // Check if we successfully extracted any sections
      const successfulExtractions = Object.values(documentSections).filter(s => !s.includes('No specific feedback')).length;

      // Parse critical checks results (same for both success and fallback)
      const criticalChecksResults = [];
      const criticalCheckPattern = /###\s*Critical Check:\s*([^\n]+)\n\*\*Status:\*\*\s*(PASS|FAIL|WARNING)[^\n]*\n\*\*Details:\*\*\s*([^\n]+)\n\*\*Issue:\*\*\s*([^\n]+)/gi;
      let checkMatch;

      while ((checkMatch = criticalCheckPattern.exec(fullFeedback)) !== null) {
        criticalChecksResults.push({
          check_name: checkMatch[1].trim(),
          status: checkMatch[2].trim().toUpperCase(),
          details: checkMatch[3].trim(),
          issue: checkMatch[4].trim(),
        });
      }

      console.log('Parsed critical checks:', criticalChecksResults.length);

      // If extraction failed for all documents, use full feedback for first document
      if (successfulExtractions === 0) {
        console.log('⚠️ Failed to extract individual sections. Using full feedback as fallback.');
        const results = documentsWithData.map((doc, index) => ({
          document_id: doc.id,
          document_name: doc.name,
          document_type: doc.type,
          // Show full feedback only for first document, others get empty
          ai_feedback: index === 0 ? fullFeedback : `See full analysis in the first document (${documentsWithData[0].name})`,
          sequence_order: index + 1,
        }));

        return NextResponse.json({
          success: true,
          full_feedback: fullFeedback,
          results,
          extracted_data: extractedMap,
          critical_checks_results: criticalChecksResults,
          critical_checks_list: criticalChecks,
        });
      }

      // Build results array with extracted sections
      const results = documentsWithData.map((doc, index) => ({
        document_id: doc.id,
        document_name: doc.name,
        document_type: doc.type,
        ai_feedback: documentSections[doc.id] || 'No feedback generated for this document.',
        sequence_order: index + 1,
      }));

      // --- START: Save to History ---
      try {
        // 1. Get opportunity_id if not provided
        let oppId = body.opportunity_id;
        if (!oppId && quotation_id) {
          const { data: qData } = await supabase
            .from('quotations')
            .select('opportunity_id')
            .eq('id', quotation_id)
            .single();
          oppId = qData?.opportunity_id;
        }

        if (oppId) {
          // 2. Get current max version
          const { data: latestVersion } = await supabase
            .from('document_analysis_history')
            .select('version')
            .eq('quotation_id', quotation_id)
            .order('version', { ascending: false })
            .limit(1)
            .single();

          const nextVersion = (latestVersion?.version || 0) + 1;

          // 3. Determine overall status
          let overallStatus = 'PASS';
          if (criticalChecksResults.some(c => c.status === 'FAIL')) overallStatus = 'FAIL';
          else if (criticalChecksResults.some(c => c.status === 'WARNING')) overallStatus = 'WARNING';

          // 4. Save to history
          await supabase.from('document_analysis_history').insert({
            quotation_id,
            opportunity_id: oppId,
            rule_id,
            version: nextVersion,
            results: results,
            critical_checks_results: criticalChecksResults,
            status: overallStatus,
            created_by: user_id
          });

          console.log(`✅ Saved analysis history version ${nextVersion} for opportunity ${oppId}`);
        }
      } catch (historyError) {
        console.error('⚠️ Failed to save analysis history:', historyError);
        // We don't return error here to avoid breaking the core analysis response
      }
      // --- END: Save to History ---

      return NextResponse.json({
        success: true,
        full_feedback: fullFeedback,
        results,
        extracted_data: extractedMap,
        critical_checks_results: criticalChecksResults,
        critical_checks_list: criticalChecks,
      });

    } catch (error) {
      console.error('❌ Failed to process cross-document comparison:', error);

      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to process cross-document comparison. Please try again.';
      let statusCode = 500;

      if (error instanceof Error) {
        // Check for common Gemini API errors
        if (error.message.includes('API_KEY_INVALID') || error.message.includes('PERMISSION_DENIED')) {
          errorMessage = 'AI service authentication failed. Please check your API key configuration.';
          statusCode = 401;
        } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota') || error.message.includes('429')) {
          errorMessage = 'AI service quota exceeded. The system will automatically retry, or please try again in a few minutes. Consider upgrading your plan for higher limits.';
          statusCode = 429;
        } else if (error.message.includes('INVALID_ARGUMENT')) {
          errorMessage = 'Invalid document data provided. Please ensure all documents are valid and not corrupted.';
          statusCode = 400;
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          errorMessage = 'Document analysis timed out. Please try with fewer documents or smaller files.';
          statusCode = 408;
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = 'Network error occurred while processing documents. Please check your internet connection and try again.';
          statusCode = 503;
        } else if (error.message.includes('Max retries exceeded')) {
          errorMessage = 'AI service is temporarily unavailable after multiple retry attempts. Please try again later.';
          statusCode = 503;
        }

        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

  } catch (error: unknown) {
    console.error('Error in document comparison:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 