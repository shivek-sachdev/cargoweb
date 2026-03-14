# Cargo App - Full Project Revision (Final Reference)

**Document Date:** March 14, 2025  
**Project:** cargo.omgexp.com – OMGEXP Logistics Platform  
**Status:** Implementation Complete

---

## 1. Executive Summary

This document captures the comprehensive revision of the cargo-app project: redundancy cleanup, professional air freight status pipeline, product-specific document templates, enhanced Telegram bot, and streamlined features around a Salesforce-style opportunity pipeline.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 18, Radix UI, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage, Cloudflare R2 |
| AI | Google Gemini (gemini-2.0-flash) |
| PDF | jsPDF |
| Deployment | Vercel |

---

## 3. Portals & Routes

### 3.1 Admin/Staff Portal
- **Dashboard:** `/dashboard`
- **Opportunities:** `/opportunities` (Kanban pipeline)
- **Quotations:** `/quotations` (formerly shipping-calculator)
- **Quotations New/Edit:** `/quotations/new`, `/quotations/preview`, `/quotations/print/[id]`
- **Document Submissions:** `/document-submissions`
- **Document Comparison:** `/document-comparison`, `/document-comparison/rules`
- **Packing Lists:** `/packing-lists`, `/packing-list`
- **Calendar:** `/calendar`
- **CMS:** `/cms/news`, `/cms/resources`
- **Settings:** `/settings/company`, `/settings/destination`, `/settings/freight-rate`, `/settings/products`, `/settings/ai`
- **Product Document Templates:** `/settings/products/[id]/documents`
- **Admin Templates:** `/admin/templates`

### 3.2 Customer Portal
- **My Shipments:** `/portal`
- **Shipment Detail:** `/portal/shipments/[id]`
- **Request Quote:** `/portal/quotations/new`
- **Quotation Detail:** `/portal/quotations/[id]`
- **Profile:** `/portal/profile`

### 3.3 Marketing Site (cargo.omgexp.com)
- **Home:** `/site`
- **About, Contact, Services:** `/site/about`, `/site/contact`, `/site/services`
- **Newsroom:** `/site/newsroom`, `/site/newsroom/[slug]`
- **Resources:** `/site/resources`, `/site/resources/[slug]`

### 3.4 Public
- **Document Upload:** `/documents-upload/[id]` (product-aware checklist)
- **Tracking:** `/track/[token]`
- **Company Onboarding:** `/company-onboarding/[token]`

---

## 4. Professional Air Freight Status Pipeline (Simplified)

### 4.1 Opportunity Stages (5 Main + 2 Special)

| Stage | Label | Description |
|-------|-------|-------------|
| `new` | New | New shipment initiated |
| `under_review` | Under Review | Documents submitted, team reviewing |
| `pending_booking` | Pending Booking | Docs approved, booking with airline |
| `booking_confirmed` | Booking Confirmed | AWB and other docs uploaded |
| `delivered` | Delivered | Shipment complete |
| `on_hold` | On Hold | Paused |
| `cancelled` | Cancelled | Cancelled |

### 4.2 Quotation Statuses (Financial Only)
`draft`, `sent`, `accepted`, `rejected`, `pending_approval`

### 4.3 Migration
- `supabase/migrations/20250314000000_air_freight_status_pipeline.sql` maps old stages to new.

---

## 5. Product-Specific Document Templates

### 5.1 Architecture
- **Company documents:** Licenses, registrations – uploaded once per company (`company_documents` table).
- **Shipment documents:** Vary by product (cannabis, hemp, extracts) – defined in `product_document_templates`.

### 5.2 New Tables
- **product_document_templates:** Links products to required document types (document_type_id, is_required, sort_order, example_file_url).
- **company_documents:** Company-level uploaded documents.

### 5.3 Flow
1. Staff selects **Product** when creating quotation.
2. System loads `product_document_templates` for that product.
3. `required_doc_types` saved on quotation.
4. Customer upload page shows only required document types for that product.

### 5.4 Admin
- **Product Document Templates:** `/settings/products/[id]/documents` – define which documents each product requires.
- **Global Templates:** `/admin/templates` – example files per document type.

---

## 6. Backend Masters

| Master | Route | Purpose |
|--------|-------|---------|
| Customer Master | `/settings/company/*` | Companies/customers |
| Destination Master | `/settings/destination/*` | Countries, ports |
| Freight Rate Master | `/settings/freight-rate/*` | Rates by destination/weight |
| Product Master | `/settings/products/*` | Products + document templates |
| AI Settings | `/settings/ai` | Gemini API key |

---

## 7. Telegram Bot

### 7.1 Setup
1. Create bot via @BotFather.
2. Set webhook: `https://cargo.omgexp.com/api/telegram/webhook`
3. Env: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`

### 7.2 Commands & Tools
- **createQuotation:** Create quotation with customer, destination, pallet dimensions (e.g. "80x120x154"), weight, rate. Generates and sends PDF.
- **updateQuotation:** Change rate (e.g. "Change rate from 300 to 315"). Regenerates and sends PDF.
- **getQuotationPDF:** Send quotation PDF to chat.
- **listCustomers:** List companies.
- **getCustomerQuotations:** List quotations for a customer.
- **checkStatus:** Quotation status and document count.
- **listQuotations:** Recent quotations.
- **getFreightRates:** Rates and cost estimate by destination/weight.

### 7.3 Example Prompts
- "Create a quotation for Customer X, for Zurich using standard rate, pallet size is 80 x 120 x 154"
- "Change the rate from 300 to 315"
- "Send me the PDF for QT-2025-0001"

---

## 8. Redundancy Cleanup (Completed)

| Removed | Reason |
|---------|--------|
| `ai-doc-review-main/` | Logic copied into main app |
| `/settings/freight-rates` | Mock data; real page is `/settings/freight-rate` |
| `mcp-quotation-server/` | Empty/non-existent |
| `/shipping-calculator` | Renamed to `/quotations` |

---

## 9. Key Files Reference

| Area | Files |
|------|-------|
| Opportunity types | `src/types/opportunity.ts` |
| Kanban board | `src/components/opportunities/kanban-board.tsx` |
| Stage progress | `src/components/opportunities/stage-progress-bar.tsx` |
| Product doc templates | `src/app/(main)/settings/products/[id]/documents/page.tsx` |
| Quotation documents | `src/components/quotations/quotation-documents.tsx` |
| Document upload | `src/app/documents-upload/[id]/page.tsx` |
| Telegram webhook | `src/app/api/telegram/webhook/route.ts` |
| PDF generation | `src/lib/quotation-pdf-server.ts` |
| DB helpers | `src/lib/db.ts` (getProductDocumentTemplates, etc.) |

---

## 10. Migrations to Run

1. `supabase/migrations/20250314000000_air_freight_status_pipeline.sql` – stage mapping
2. `supabase/migrations/20250314000001_product_document_templates.sql` – product_document_templates, company_documents tables

---

## 11. Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY` (or stored in settings table)
- R2: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_DOCS_BUCKET_NAME`, `R2_ENDPOINT`, etc.

---

*End of document*
