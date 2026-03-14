-- Product-specific document templates: which documents are required per product type (cannabis, hemp, extracts, etc.)
CREATE TABLE IF NOT EXISTS public.product_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  document_type_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  example_file_url TEXT,
  example_file_path TEXT,
  storage_provider TEXT DEFAULT 'r2',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, document_type_id)
);

CREATE INDEX IF NOT EXISTS idx_product_document_templates_product_id ON public.product_document_templates(product_id);

ALTER TABLE public.product_document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_document_templates_select" ON public.product_document_templates;
CREATE POLICY "product_document_templates_select" ON public.product_document_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_document_templates_insert" ON public.product_document_templates;
CREATE POLICY "product_document_templates_insert" ON public.product_document_templates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "product_document_templates_update" ON public.product_document_templates;
CREATE POLICY "product_document_templates_update" ON public.product_document_templates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "product_document_templates_delete" ON public.product_document_templates;
CREATE POLICY "product_document_templates_delete" ON public.product_document_templates FOR DELETE USING (true);

-- Company-level documents: uploaded once per company (licenses, registrations)
CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  file_path TEXT,
  storage_provider TEXT DEFAULT 'r2',
  status TEXT DEFAULT 'submitted',
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON public.company_documents(company_id);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_documents_select" ON public.company_documents;
CREATE POLICY "company_documents_select" ON public.company_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "company_documents_insert" ON public.company_documents;
CREATE POLICY "company_documents_insert" ON public.company_documents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "company_documents_update" ON public.company_documents;
CREATE POLICY "company_documents_update" ON public.company_documents FOR UPDATE USING (true);

DROP POLICY IF EXISTS "company_documents_delete" ON public.company_documents;
CREATE POLICY "company_documents_delete" ON public.company_documents FOR DELETE USING (true);
