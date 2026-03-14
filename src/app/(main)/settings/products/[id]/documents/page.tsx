'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { getProductWithCharges, Product } from '@/lib/db';
import { toast } from 'sonner';

const ALL_DOCUMENT_TYPES = [
  { id: 'company-registration', name: 'Company Registration', category: 'Company' },
  { id: 'company-declaration', name: 'Company Declaration', category: 'Company' },
  { id: 'id-card-copy', name: 'ID Card Copy', category: 'Company' },
  { id: 'import-permit', name: 'Import Permit', category: 'Permits' },
  { id: 'tk-10', name: 'TK 10', category: 'Permits' },
  { id: 'tk-10-eng', name: 'TK 10 (ENG)', category: 'Permits' },
  { id: 'tk-11', name: 'TK 11', category: 'Permits' },
  { id: 'tk-11-eng', name: 'TK 11 (ENG)', category: 'Permits' },
  { id: 'tk-31', name: 'TK 31', category: 'Permits' },
  { id: 'tk-31-eng', name: 'TK 31 (ENG)', category: 'Permits' },
  { id: 'tk-32', name: 'TK 32', category: 'Permits' },
  { id: 'purchase-order', name: 'Purchase Order', category: 'Shipping' },
  { id: 'msds', name: 'MSDS', category: 'Shipping' },
  { id: 'commercial-invoice', name: 'Commercial Invoice', category: 'Shipping' },
  { id: 'packing-list', name: 'Packing List', category: 'Shipping' },
  { id: 'hemp-letter', name: 'Hemp Letter', category: 'Additional' },
  { id: 'additional-file', name: 'Additional File', category: 'Additional' },
];

interface ProductDocumentTemplate {
  id: string;
  product_id: string;
  document_type_id: string;
  document_name: string;
  is_required: boolean;
  sort_order: number;
  example_file_url?: string;
  example_file_path?: string;
  storage_provider?: string;
  description?: string;
}

export default function ProductDocumentsPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [templates, setTemplates] = useState<ProductDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!productId) return;
      try {
        const [productData, { data: templateData }] = await Promise.all([
          getProductWithCharges(productId),
          supabase.from('product_document_templates').select('*').eq('product_id', productId).order('sort_order'),
        ]);
        if (productData) setProduct(productData);
        setTemplates((templateData as ProductDocumentTemplate[]) || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  const toggleDocument = async (docType: { id: string; name: string }, enabled: boolean) => {
    if (enabled) {
      const { error } = await supabase.from('product_document_templates').upsert({
        product_id: productId,
        document_type_id: docType.id,
        document_name: docType.name,
        is_required: true,
        sort_order: templates.length,
      }, { onConflict: 'product_id,document_type_id' });
      if (error) {
        toast.error(error.message);
        return;
      }
      setTemplates((prev) => [...prev.filter((t) => t.document_type_id !== docType.id), { id: '', product_id: productId, document_type_id: docType.id, document_name: docType.name, is_required: true, sort_order: prev.length } as ProductDocumentTemplate]);
      toast.success(`Added ${docType.name}`);
    } else {
      const { error } = await supabase.from('product_document_templates').delete().eq('product_id', productId).eq('document_type_id', docType.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.document_type_id !== docType.id));
      toast.success(`Removed ${docType.name}`);
    }
  };

  const updateRequired = async (docTypeId: string, isRequired: boolean) => {
    const { error } = await supabase.from('product_document_templates').update({ is_required: isRequired }).eq('product_id', productId).eq('document_type_id', docTypeId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates((prev) => prev.map((t) => (t.document_type_id === docTypeId ? { ...t, is_required: isRequired } : t)));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Product not found</h2>
        <Link href="/settings/products">
          <Button variant="link">Back to Product Master</Button>
        </Link>
      </div>
    );
  }

  const templateMap = Object.fromEntries(templates.map((t) => [t.document_type_id, t]));
  const byCategory = ALL_DOCUMENT_TYPES.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = [];
    acc[d.category].push(d);
    return acc;
  }, {} as Record<string, typeof ALL_DOCUMENT_TYPES>);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/settings/products/${productId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Document Templates: {product.name}</h1>
          <p className="text-slate-500">Define which documents are required for shipments of this product (e.g. cannabis, hemp, extracts)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Required Documents
          </CardTitle>
          <CardDescription>
            Check the documents that customers must upload when shipping this product. When creating a quotation with this product, the document checklist will be generated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(byCategory).map(([category, docTypes]) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2">
                  <h3 className="font-medium text-slate-700">{category}</h3>
                </div>
                <div className="divide-y">
                  {docTypes.map((docType) => {
                    const t = templateMap[docType.id];
                    const enabled = !!t;
                    return (
                      <div key={docType.id} className="flex items-center gap-4 px-4 py-3">
                        <Checkbox
                          id={`doc-${docType.id}`}
                          checked={enabled}
                          onCheckedChange={(c) => toggleDocument(docType, !!c)}
                        />
                        <Label htmlFor={`doc-${docType.id}`} className="flex-1 font-medium cursor-pointer">
                          {docType.name}
                        </Label>
                        {enabled && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`req-${docType.id}`} className="text-xs text-slate-500">Required</Label>
                            <Checkbox
                              id={`req-${docType.id}`}
                              checked={t.is_required}
                              onCheckedChange={(c) => updateRequired(docType.id, !!c)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
