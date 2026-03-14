"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getDocumentSubmissions, deleteDocumentSubmission, DocumentSubmission } from '@/lib/db';
import { getFileUrl } from '@/lib/storage';
import { FileText, ExternalLink, Loader2, File, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InternalUploadDialog } from './internal-upload-dialog';
import { toast } from 'sonner';


const ALL_DOC_CATEGORIES = [
    {
        id: 'company-info',
        name: 'Company Information',
        types: [
            { id: 'company-registration', name: 'Company Registration' },
            { id: 'company-declaration', name: 'Company Declaration' },
            { id: 'id-card-copy', name: 'ID Card Copy' }
        ]
    },
    {
        id: 'permits-forms',
        name: 'Permits & TK Forms',
        types: [
            { id: 'import-permit', name: 'Import Permit' },
            { id: 'tk-10', name: 'TK 10' },
            { id: 'tk-10-eng', name: 'TK 10 (ENG)' },
            { id: 'tk-11', name: 'TK 11' },
            { id: 'tk-11-eng', name: 'TK 11 (ENG)' },
            { id: 'tk-31', name: 'TK 31' },
            { id: 'tk-31-eng', name: 'TK 31 (ENG)' },
            { id: 'tk-32', name: 'TK 32' }
        ]
    },
    {
        id: 'shipping-docs',
        name: 'Shipping Documents',
        types: [
            { id: 'purchase-order', name: 'Purchase Order' },
            { id: 'msds', name: 'MSDS' },
            { id: 'commercial-invoice', name: 'Commercial Invoice' },
            { id: 'packing-list', name: 'Packing List' }
        ]
    },
    {
        id: 'additional',
        name: 'Additional Documents',
        types: [
            { id: 'hemp-letter', name: 'Letter (Hemp Case)' },
            { id: 'additional-file', name: 'Additional File' }
        ]
    }
];

interface QuotationDocumentsProps {
    quotationId: string;
    requiredDocTypes?: string[] | null;
}

export function QuotationDocuments({ quotationId, requiredDocTypes }: QuotationDocumentsProps) {
    const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const docs = await getDocumentSubmissions(quotationId);
            if (docs && docs.length > 0) {
                // Resolve URLs for each document based on provider
                const docsWithUrls = await Promise.all(docs.map(async (doc) => {
                    const resolvedUrl = await getFileUrl(doc.file_path || '', doc.storage_provider || 'supabase');
                    return { ...doc, file_url: resolvedUrl };
                }));
                setDocuments(docsWithUrls);
            } else {
                setDocuments([]);
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setLoading(false);
        }
    }, [quotationId]);

    useEffect(() => {
        if (quotationId) {
            fetchDocuments();
        }
    }, [quotationId, fetchDocuments]);

    const handleDelete = async (docId: string, fileName: string) => {
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        try {
            const success = await deleteDocumentSubmission(docId);
            if (success) {
                toast.success('Document deleted');
                fetchDocuments(); // Refresh the list
            } else {
                toast.error('Failed to delete document');
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('An error occurred');
        }
    };

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (loading) {
        return <div className="p-2 text-xs text-gray-400 flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Loading documents...</div>;
    }

    const uploadedTypesNormalized = documents.map(d => normalize(d.document_type || ''));

    // Process all categories - when requiredDocTypes is set (product-specific), filter to only show those document types
    const processedCategories = ALL_DOC_CATEGORIES.map(cat => {
        let types = cat.types.map(type => {
            const isUploaded = uploadedTypesNormalized.some(upType =>
                upType === normalize(type.id) || upType.includes(normalize(type.id)) || normalize(type.id).includes(upType)
            );
            return { ...type, isUploaded };
        });
        if (requiredDocTypes && requiredDocTypes.length > 0) {
            types = types.filter(t => requiredDocTypes.some(req => normalize(t.id) === normalize(req)));
        }
        const matchedCount = types.filter(t => t.isUploaded).length;
        const isRequired = requiredDocTypes && requiredDocTypes.length > 0 && types.some(t =>
            requiredDocTypes.some(req => normalize(t.id) === normalize(req))
        );
        return { ...cat, types, matchedCount, isRequired };
    }).filter(cat => cat.types.length > 0);

    const totalMatched = processedCategories.reduce((sum, cat) => sum + cat.matchedCount, 0);
    const totalRequired = processedCategories.reduce((sum, cat) => sum + cat.types.length, 0);

    const formatDocName = (id: string, name?: string) => {
        const docId = id.toLowerCase();
        if (docId === 'commercial-invoice') return 'IV';
        if (docId === 'packing-list') return 'PL';
        if (docId === 'id-card-copy') return 'ID Card';
        if (docId === 'company-registration') return 'Company Reg';

        if (docId.startsWith('tk-')) {
            const baseName = (name || docId).toUpperCase().replace('-ENG', '').replace(' (ENG)', '').replace('TK-', 'TK ');
            return docId.endsWith('-eng') ? `${baseName} (EN)` : `${baseName} (TH)`;
        }

        return name || id;
    };

    return (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            {/* COMPACT HEADER */}
            <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 leading-none">Audit Status</h4>
                        <p className="text-[9px] text-slate-400 font-bold mt-1.5 uppercase tracking-tighter">
                            {totalMatched} / {totalRequired} Matched
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex gap-1 bg-white/5 p-1.5 rounded-full border border-white/10">
                        {processedCategories.map((cat) => (
                            <div
                                key={cat.id}
                                className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${cat.matchedCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                            />
                        ))}
                    </div>
                    <InternalUploadDialog
                        quotationId={quotationId}
                        companyName="Internal Upload"
                        onUploadSuccess={fetchDocuments}
                    />
                </div>
            </div>

            {/* COMPACT CATEGORY LIST */}
            <div className="space-y-2">
                {processedCategories.map(cat => {
                    const missingInCat = cat.types.filter(t => !t.isUploaded);
                    const isFullyUploaded = missingInCat.length === 0;

                    if (isFullyUploaded && documents.length > 5) return null; // Hide finished categories if there are many files

                    return (
                        <div key={cat.id} className={`bg-white border rounded-xl p-3 shadow-sm transition-all ${isFullyUploaded ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-50 shrink-0">
                                    {isFullyUploaded ? (
                                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </div>
                                <span className="flex-1 text-xs font-black uppercase tracking-tight text-slate-900 leading-tight">
                                    {cat.name}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 ml-1">
                                {cat.types.map(type => (
                                    <div
                                        key={type.id}
                                        className={`px-2 py-1 rounded-md text-[9px] font-black border tracking-tighter uppercase transition-all ${type.isUploaded
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                                            : 'bg-red-50 text-red-700 border-red-100'
                                            }`}
                                    >
                                        {formatDocName(type.id, type.name)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ATTACHED FILES - TIGHT GRID */}
            {documents.length > 0 && (
                <div className="pt-3">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center">
                            <File className="h-4 w-4 mr-2 text-emerald-600" />
                            Verified Files ({documents.length})
                        </h5>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all group overflow-hidden">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                                        <FileText className="h-4 w-4 text-slate-600 group-hover:text-emerald-600" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 truncate uppercase mt-0.5" title={doc.document_type}>
                                        {formatDocName(doc.document_type || 'file')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 ml-1 shrink-0">
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full border border-transparent hover:border-emerald-100">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        onClick={() => handleDelete(doc.id, doc.file_name)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
