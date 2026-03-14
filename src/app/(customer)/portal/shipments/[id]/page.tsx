'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Plane, Package, MapPin, CalendarDays,
    CheckCircle2, Loader2, FileText, Download,
    Save, Trash2, Plus, Info, XCircle, Clock,
    Image as ImageIcon, FileSpreadsheet, Upload,
    ChevronUp, ChevronDown, Eye, Calculator, Share2, Check
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import {
    getCustomerQuotationById,
    getCustomerDocuments,
    updateCustomerQuotation,
    submitCustomerDocument,
    getFreightRatesByDestination,
    generateCustomerShareToken,
} from '@/lib/customer-db';
import { calculateVolumeWeight } from '@/lib/calculators';
import type { Quotation, DocumentSubmission, AdditionalCharge, Pallet } from '@/lib/db';
import type { FreightRate } from '@/lib/customer-db';
import { getFileUrl } from '@/lib/storage';
import { toast } from 'react-hot-toast';
import { getDocumentTemplate } from '@/lib/db';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Leaf } from 'lucide-react';

// ============ CONSTANTS ============

const DOCUMENT_CATEGORIES = [
    {
        id: 'company-info', name: 'Company Information',
        types: [
            { id: 'company-registration', name: 'Company Registration' },
            { id: 'company-declaration', name: 'Company Declaration' },
            { id: 'id-card-copy', name: 'ID Card Copy' }
        ]
    },
    {
        id: 'permits-forms', name: 'Permits & TK Forms',
        types: [
            { id: 'import-permit', name: 'Import Permit' },
            { id: 'tk-10', name: 'TK 10' },
            { id: 'tk-10-eng', name: 'TK 10 (ENG Version)' },
            { id: 'tk-11', name: 'TK 11' },
            { id: 'tk-11-eng', name: 'TK 11 (ENG Version)' },
            { id: 'tk-31', name: 'TK 31' },
            { id: 'tk-31-eng', name: 'TK 31 (ENG Version)' },
            { id: 'tk-32', name: 'TK 32' }
        ]
    },
    {
        id: 'shipping-docs', name: 'Shipping Documents',
        types: [
            { id: 'purchase-order', name: 'Purchase Order' },
            { id: 'msds', name: 'MSDS' },
            { id: 'commercial-invoice', name: 'Commercial Invoice' },
            { id: 'packing-list', name: 'Packing List' }
        ]
    },
    {
        id: 'additional', name: 'Additional Documents',
        types: [
            { id: 'hemp-letter', name: 'Letter (Hemp Case)' },
            { id: 'additional-file', name: 'Additional File' }
        ]
    }
];

const GACP_DOCS_STANDARD = [
    { id: 'thai-gacp-certificate-standard', name: 'Thai GACP or GACP Certificate' }
];

const GACP_DOCS_FARM = [
    { id: 'farm-purchase-order', name: 'Farm Purchase Order' },
    { id: 'farm-commercial-invoice', name: 'Farm Commercial Invoice' },
    { id: 'thai-gacp-certificate-farm', name: 'Thai GACP Certificate (Farm)' }
];

const TRACKING_STEPS = [
    { label: 'Pending Docs', step: 1 },
    { label: 'Pending Booking', step: 2 },
    { label: 'Booking Requested', step: 3 },
    { label: 'AWB Received', step: 4 },
    { label: 'Delivered', step: 5 }
];

// ============ HELPERS ============

function formatDate(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
}

function formatAmount(amount: number) {
    return `฿${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getStageDisplay(stage?: string, status?: string) {
    if (status === 'completed') return { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5 };
    if (status === 'Shipped') return { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4 };
    const stageMap: Record<string, { label: string; color: string; bgColor: string; step: number }> = {
        new: { label: 'New', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200', step: 1 },
        under_review: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2 },
        pending_booking: { label: 'Pending Booking', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', step: 3 },
        booking_confirmed: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4 },
        delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5 },
        cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', step: 0 },
        on_hold: { label: 'On Hold', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', step: 2 },
        pending_docs: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2 },
        documents_submitted: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2 },
        payment_received: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5 },
        awb_received: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4 },
        booking_requested: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4 },
    };
    return stageMap[stage || ''] || { label: 'New', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200', step: 0 };
}

// ============ SUB-COMPONENTS ============

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-600 border-gray-200',
        sent: 'bg-blue-50 text-blue-700 border-blue-200',
        accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rejected: 'bg-red-50 text-red-700 border-red-200',
        completed: 'bg-violet-50 text-violet-700 border-violet-200',
        docs_uploaded: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        Shipped: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${styles[status] || styles.draft}`}>
            {status.replace('_', ' ')}
        </span>
    );
}

function DocStatusBadge({ status }: { status: string }) {
    const config: Record<string, { icon: React.ElementType; label: string; className: string }> = {
        approved: { icon: CheckCircle2, label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
        submitted: { icon: Clock, label: 'Under Review', className: 'bg-blue-50 text-blue-700' },
        rejected: { icon: XCircle, label: 'Rejected', className: 'bg-red-50 text-red-700' },
        pending: { icon: Clock, label: 'Pending', className: 'bg-amber-50 text-amber-700' },
        reviewed: { icon: CheckCircle2, label: 'Reviewed', className: 'bg-emerald-50 text-emerald-700' },
    };
    const c = config[status] || config.submitted;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.className}`}>
            <Icon className="w-3 h-3" /> {c.label}
        </span>
    );
}

function FileIcon({ mimeType }: { mimeType?: string }) {
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (mimeType?.includes('image')) return <ImageIcon className="w-5 h-5 text-violet-500" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
}

function TrackingProgress({ sc }: { sc: ReturnType<typeof getStageDisplay> }) {
    return (
        <div className="px-2">
            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full" />
                <div
                    className={`absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-1000 ${sc.step === 5 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((sc.step / 5) * 100, 100)}%` }}
                />
                <div className="relative flex justify-between">
                    {TRACKING_STEPS.map((step) => {
                        const isActive = sc.step >= step.step;
                        const isCurrent = sc.step === step.step;
                        return (
                            <div key={step.step} className="flex flex-col items-center">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10 ${isCurrent
                                    ? 'bg-white border-blue-600 scale-125 shadow-lg shadow-blue-100'
                                    : isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                                    }`}>
                                    {isActive && !isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    {isCurrent && <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-tighter mt-3 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============ INTERFACES ============

interface QueuedFile {
    file: File;
    documentType: string;
    documentTypeName: string;
    id: string;
}

// ============ MAIN PAGE ============

export default function ShipmentDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user, isLoading: authLoading } = useCustomerAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [pallets, setPallets] = useState<Pallet[]>([]);
    const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
    const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
    const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
    const [isThaiGacp, setIsThaiGacp] = useState(false);
    const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
    const [resolvedShippingUrls, setResolvedShippingUrls] = useState<{ awb?: string; customs?: string }>({});

    // Share link state
    const [sharing, setSharing] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);

    // Documents & Upload sections collapsed
    const [docsOpen, setDocsOpen] = useState(false);
    const [submittedOpen, setSubmittedOpen] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'company-info': true, 'permits-forms': true,
        'shipping-docs': true, 'additional': true, 'gacp-certification': true
    });

    // ---- Data loading ----
    const loadData = async () => {
        if (!user?.id || !id) return;
        try {
            const [qData, docsData] = await Promise.all([
                getCustomerQuotationById(id, user.id),
                getCustomerDocuments(user.id),
            ]);
            if (!qData) {
                toast.error('Shipment not found');
                router.push('/portal');
                return;
            }
            setQuotation(qData);
            setPallets(qData.pallets || []);
            if (qData.destination_id) {
                const rates = await getFreightRatesByDestination(qData.destination_id);
                setFreightRates(rates);
            }

            // Resolve Document URLs
            const docsWithUrls = await Promise.all(docsData.filter(d => d.quotation_id === id).map(async (doc) => {
                const url = await getFileUrl(doc.file_path || '', doc.storage_provider || 'supabase');
                return { ...doc, file_url: url };
            }));
            setDocuments(docsWithUrls);

            // Resolve Shipping Doc URLs
            const shippingUrls: { awb?: string; customs?: string } = {};
            if (qData.awb_file_url) {
                const path = qData.awb_file_url.includes('supabase') ? qData.awb_file_url.split('/public/')[1] || qData.awb_file_url : qData.awb_file_url;
                shippingUrls.awb = await getFileUrl(path, qData.storage_provider || 'supabase');
            }
            if (qData.customs_declaration_file_url) {
                const path = qData.customs_declaration_file_url.includes('supabase') ? qData.customs_declaration_file_url.split('/public/')[1] || qData.customs_declaration_file_url : qData.customs_declaration_file_url;
                shippingUrls.customs = await getFileUrl(path, qData.storage_provider || 'supabase');
            }
            setResolvedShippingUrls(shippingUrls);

        } catch (err) {
            console.error('Load error:', err);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) { setLoading(false); return; }
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user?.id, authLoading]);

    // ---- Calculations ----
    const totals = useMemo(() => {
        if (!quotation) return null;
        let totalFreightCost = 0, totalActualWeight = 0, totalVolumeWeight = 0;

        pallets.forEach(pallet => {
            const length = Number(pallet.length) || 0;
            const width = Number(pallet.width) || 0;
            const height = Number(pallet.height) || 0;
            const weight = Number(pallet.weight) || 0;
            const quantity = Number(pallet.quantity) || 1;
            const volWt = calculateVolumeWeight(length, width, height);
            const chargeableWeight = Math.max(volWt, weight);

            const applicableRates = freightRates.filter(rate =>
                (rate.min_weight === null || chargeableWeight >= rate.min_weight) &&
                (rate.max_weight === null || chargeableWeight <= rate.max_weight)
            );
            const rate = applicableRates.length > 0 ? applicableRates[0].base_rate : 0;
            const cost = Math.round(chargeableWeight * rate) * quantity;
            totalFreightCost += cost;
            totalActualWeight += weight * quantity;
            totalVolumeWeight += volWt * quantity;
        });

        const chargeableWeight = Math.max(totalActualWeight, totalVolumeWeight);
        const deliveryRates: Record<string, number> = { '4wheel': 3500, '6wheel': 6500 };
        const deliveryCost = quotation.delivery_service_required && quotation.delivery_vehicle_type
            ? (deliveryRates[quotation.delivery_vehicle_type] || 0) : 0;
        const totalAdditionalCharges = (quotation.additional_charges || []).reduce(
            (sum: number, charge: AdditionalCharge) => sum + (Number(charge.amount) || 0), 0);
        const totalCost = totalFreightCost + deliveryCost + (quotation.clearance_cost || 0) + totalAdditionalCharges;

        return { totalFreightCost, deliveryCost, totalActualWeight, totalVolumeWeight, chargeableWeight, totalCost };
    }, [pallets, quotation, freightRates]);

    // ---- Pallet handlers ----
    const handlePalletChange = (index: number, field: string, value: string | number) => {
        const np = [...pallets];
        np[index] = { ...np[index], [field]: value };
        setPallets(np);
    };

    const addPallet = () => setPallets([...pallets, { length: 0, width: 0, height: 0, weight: 0, quantity: 1 }]);

    const removePallet = (index: number) => {
        if (pallets.length <= 1) { toast.error('At least one pallet is required'); return; }
        const np = [...pallets]; np.splice(index, 1); setPallets(np);
    };

    const handleSave = async () => {
        if (!quotation) return;
        setSaving(true);
        try {
            let totalFreightCost = 0, totalActualWeight = 0, totalVolumeWeight = 0;
            const updatedPallets = pallets.map((pallet: Pallet) => {
                const length = Number(pallet.length) || 0, width = Number(pallet.width) || 0;
                const height = Number(pallet.height) || 0, weight = Number(pallet.weight) || 0;
                const quantity = Number(pallet.quantity) || 1;
                const volWt = calculateVolumeWeight(length, width, height);
                const chargeableWeight = Math.max(volWt, weight);
                const applicableRates = freightRates.filter(rate =>
                    (rate.min_weight === null || chargeableWeight >= rate.min_weight) &&
                    (rate.max_weight === null || chargeableWeight <= rate.max_weight));
                const rate = applicableRates.length > 0 ? applicableRates[0].base_rate : 0;
                const cost = Math.round(chargeableWeight * rate) * quantity;
                totalFreightCost += cost; totalActualWeight += weight * quantity; totalVolumeWeight += volWt * quantity;
                return { ...pallet, length, width, height, weight, quantity, volumeWeight: volWt, chargeableWeight, customerFreightCost: cost / quantity };
            });
            const chargeableWeight = Math.max(totalActualWeight, totalVolumeWeight);
            const deliveryRates: Record<string, number> = { '4wheel': 3500, '6wheel': 6500 };
            const deliveryCost = quotation.delivery_service_required && quotation.delivery_vehicle_type ? (deliveryRates[quotation.delivery_vehicle_type] || 0) : 0;
            const totalAdditionalCharges = (quotation.additional_charges || []).reduce((sum: number, c: AdditionalCharge) => sum + (Number(c.amount) || 0), 0);
            const totalCost = totalFreightCost + deliveryCost + (quotation.clearance_cost || 0) + totalAdditionalCharges;

            const success = await updateCustomerQuotation(quotation.id, {
                pallets: updatedPallets, total_freight_cost: totalFreightCost,
                total_actual_weight: totalActualWeight, total_volume_weight: totalVolumeWeight,
                chargeable_weight: chargeableWeight, delivery_cost: deliveryCost,
                total_cost: totalCost, updated_at: new Date().toISOString()
            });
            if (success) { toast.success('Saved!'); await loadData(); }
            else toast.error('Failed to save');
        } catch (err) { console.error(err); toast.error('An error occurred'); }
        finally { setSaving(false); }
    };

    // ---- Document handlers ----
    const handleFileUpload = (files: FileList | null, docTypeId: string, docTypeName: string) => {
        if (!files || files.length === 0) return;
        const newItems: QueuedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} > 10MB`); continue; }
            newItems.push({ file, documentType: docTypeId, documentTypeName: docTypeName, id: Math.random().toString(36).substring(7) });
        }
        setUploadQueue(prev => [...prev, ...newItems]);
    };

    const handlePreview = async (documentTypeId: string, documentName: string) => {
        try {
            setPreviewLoading(prev => ({ ...prev, [documentTypeId]: true }));
            const template = await getDocumentTemplate(documentTypeId);
            if (template?.file_url) {
                const url = await getFileUrl(template.file_url, (template as DocumentSubmission).storage_provider || 'supabase', 'templates');
                if (url) window.open(url, '_blank');
                else toast.error('Could not resolve template URL');
            }
            else toast.error(`No template for ${documentName}`);
        } catch { toast.error('Failed to load template'); }
        finally { setPreviewLoading(prev => ({ ...prev, [documentTypeId]: false })); }
    };

    const submitAllDocuments = async () => {
        if (uploadQueue.length === 0 || !quotation) return;
        setUploading(true);
        try {
            let ok = 0;
            for (const item of uploadQueue) {
                // 1. Get Signed URL
                const generateUrlResponse = await fetch('/api/generate-upload-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: item.file.name,
                        contentType: item.file.type,
                        quotationId: id,
                        documentType: item.documentType,
                    }),
                });

                if (!generateUrlResponse.ok) throw new Error('Failed to get upload URL');
                const { signedUrl, path: filePath, provider } = await generateUrlResponse.json();

                // 2. Upload to Storage
                const storageResponse = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': item.file.type },
                    body: item.file,
                });

                if (!storageResponse.ok) throw new Error('Storage upload failed');

                // 3. Confirm via lib
                const success = await submitCustomerDocument({
                    quotation_id: id,
                    company_name: quotation.company_name || 'N/A',
                    document_type: item.documentType,
                    document_type_name: item.documentTypeName,
                    file_name: item.file.name,
                    original_file_name: item.file.name,
                    file_path: filePath,
                    file_url: filePath, // This will be resolved on load
                    file_size: item.file.size,
                    mime_type: item.file.type,
                    status: 'submitted',
                    storage_provider: (provider === 'r2' ? 'r2' : 'supabase')
                } as Omit<DocumentSubmission, 'id' | 'submitted_at'>);

                if (success) ok++;
            }
            if (ok > 0) { toast.success(`Uploaded ${ok} file(s)`); setUploadQueue([]); await loadData(); }
        } catch (err) { console.error(err); toast.error('Upload error'); }
        finally { setUploading(false); }
    };

    // ---- Share handler ----
    const handleShare = async () => {
        if (!quotation) return;
        setSharing(true);
        try {
            const token = quotation.share_token || await generateCustomerShareToken(quotation.id);
            if (token) {
                const url = `${window.location.origin}/track/${token}`;
                await navigator.clipboard.writeText(url);
                setShareCopied(true);
                toast.success('Tracking link copied to clipboard!');
                setTimeout(() => setShareCopied(false), 3000);
            } else {
                toast.error('Failed to generate share link');
            }
        } catch {
            toast.error('Failed to copy link');
        } finally {
            setSharing(false);
        }
    };

    // ---- Loading / Not found ----
    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!quotation || !totals) return null;

    const q = quotation;
    const sc = getStageDisplay(q.opportunities?.stage, q.status);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Back Button */}
            <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to My Shipments
            </Link>

            {/* ===== HEADER CARD ===== */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                        <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${sc.step === 5 ? 'bg-emerald-50 text-emerald-600' : sc.step >= 4 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                <Plane className={`w-7 h-7 ${sc.step >= 4 ? 'animate-bounce' : ''}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-xl font-bold text-gray-900">{q.quotation_no || q.id.slice(0, 8)}</h1>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${sc.bgColor} ${sc.color}`}>
                                        {sc.step === 4 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 animate-pulse" />}
                                        {sc.label}
                                    </span>
                                    <StatusBadge status={q.status} />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                    <span className="flex items-center gap-1.5 text-blue-600 font-bold"><MapPin className="w-4 h-4" /> {q.destination || 'N/A'}</span>
                                    <span className="flex items-center gap-1.5"><Package className="w-4 h-4 text-gray-400" /> {q.pallets?.length || 0} pallets</span>
                                    <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-gray-400" /> {formatDate(q.created_at)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 shrink-0">
                            <button
                                onClick={handleShare}
                                disabled={sharing}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm border ${shareCopied
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                            >
                                {sharing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : shareCopied ? (
                                    <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                    <Share2 className="w-4 h-4" />
                                )}
                                {shareCopied ? 'Copied!' : 'Share'}
                            </button>
                            <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-100">
                                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-right mb-0.5">Total</div>
                                <div className="text-2xl font-black text-gray-900">{formatAmount(totals.totalCost)}</div>
                            </div>
                        </div>
                    </div>
                    <TrackingProgress sc={sc} />
                </div>
            </div>

            {/* ===== SHIPPING INFO + WEIGHT ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Plane className="w-3.5 h-3.5" /> Shipping Info
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Shipping Date</div>
                            <div className="text-sm font-semibold text-gray-900">
                                {q.shipping_date ? new Date(q.shipping_date).toLocaleDateString('en-GB') : 'TBC'}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Vehicle</div>
                            <div className="text-sm font-semibold text-gray-900 capitalize">{q.delivery_vehicle_type || 'N/A'}</div>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Destination Port</div>
                        <div className="text-sm font-semibold text-gray-900">{q.destination || 'N/A'}</div>
                    </div>
                    {q.notes && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Notes</div>
                            <div className="text-xs text-gray-600 mt-1 italic">&quot;{q.notes}&quot;</div>
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Weight Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50 text-center">
                            <div className="text-[9px] font-bold text-emerald-600 uppercase">Actual</div>
                            <div className="text-base font-bold text-emerald-700">{totals.totalActualWeight} kg</div>
                        </div>
                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 text-center">
                            <div className="text-[9px] font-bold text-blue-600 uppercase">Volume</div>
                            <div className="text-base font-bold text-blue-700">{totals.totalVolumeWeight} kg</div>
                        </div>
                        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50 text-center">
                            <div className="text-[9px] font-bold text-amber-600 uppercase">Chargeable</div>
                            <div className="text-base font-bold text-amber-700">{totals.chargeableWeight} kg</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== COST BREAKDOWN ===== */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                    <Calculator className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cost Breakdown</span>
                    <span className="ml-auto text-[10px] text-gray-400 italic">Updates in real-time</span>
                </div>
                <div className="divide-y divide-gray-50">
                    <div className="px-5 py-3 flex justify-between items-center">
                        <div><span className="text-sm text-gray-600">Freight Cost</span><br /><span className="text-[10px] text-gray-400">Based on chargeable weight</span></div>
                        <span className="text-sm font-bold text-gray-900">{formatAmount(totals.totalFreightCost)}</span>
                    </div>
                    {totals.deliveryCost > 0 && (
                        <div className="px-5 py-3 flex justify-between items-center">
                            <span className="text-sm text-gray-600">Delivery Fee</span>
                            <span className="text-sm font-bold text-gray-900">{formatAmount(totals.deliveryCost)}</span>
                        </div>
                    )}
                    {(q.clearance_cost ?? 0) > 0 && (
                        <div className="px-5 py-3 flex justify-between items-center">
                            <span className="text-sm text-gray-600">Clearance Fee</span>
                            <span className="text-sm font-bold text-gray-900">{formatAmount(q.clearance_cost || 0)}</span>
                        </div>
                    )}
                    {q.additional_charges?.map((charge: AdditionalCharge, i: number) => (
                        <div key={i} className="px-5 py-3 flex justify-between items-center">
                            <span className="text-sm text-gray-600">{charge.name}</span>
                            <span className="text-sm font-bold text-gray-900">{formatAmount(Number(charge.amount))}</span>
                        </div>
                    ))}
                    <div className="px-5 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 flex justify-between items-center">
                        <span className="text-xs font-black text-emerald-100 uppercase tracking-widest">Total</span>
                        <span className="text-xl font-black text-white">{formatAmount(totals.totalCost)}</span>
                    </div>
                </div>
            </div>

            {/* ===== AWB + CUSTOMS (from staff) ===== */}
            {(q.awb_file_url || q.customs_declaration_file_url) && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-blue-600 rounded-full" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Shipping Documents</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.awb_file_url && (
                            <a href={resolvedShippingUrls.awb} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 transition-all group/doc">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover/doc:bg-blue-200 transition-colors">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-blue-800">AWB (Air Waybill)</div>
                                    <div className="text-[10px] text-blue-500 truncate">{q.awb_file_name || 'Download'}</div>
                                </div>
                                <Download className="w-4 h-4 text-blue-400 shrink-0 group-hover/doc:text-blue-600 transition-colors" />
                            </a>
                        )}
                        {q.customs_declaration_file_url && (
                            <a href={resolvedShippingUrls.customs} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-200 transition-all group/doc">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 group-hover/doc:bg-amber-200 transition-colors">
                                    <FileText className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-amber-800">Customs Declaration</div>
                                    <div className="text-[10px] text-amber-500 truncate">{q.customs_declaration_file_name || 'Download'}</div>
                                </div>
                                <Download className="w-4 h-4 text-amber-400 shrink-0 group-hover/doc:text-amber-600 transition-colors" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* ===== PALLET MANAGEMENT ===== */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 mb-5">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">Verify pallet dimensions. Changes will recalculate the quote in real-time.</p>
                </div>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pallets ({pallets.length})</span>
                    <button onClick={addPallet}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 flex items-center gap-1.5 transition-colors border border-emerald-100">
                        <Plus className="w-3.5 h-3.5" /> Add Pallet
                    </button>
                </div>
                <div className="space-y-3">
                    {pallets.map((pallet, idx) => (
                        <div key={idx} className="relative bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-emerald-200 transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">#{idx + 1}</div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pallet Unit</span>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {(['length', 'width', 'height', 'weight'] as const).map(field => (
                                    <div key={field} className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                                            {field === 'weight' ? 'Weight (kg)' : `${field.charAt(0).toUpperCase() + field.slice(1)} (cm)`}
                                        </label>
                                        <input type="number" value={pallet[field]}
                                            onChange={(e) => handlePalletChange(idx, field, e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Qty</label>
                                    <input type="number" value={pallet.quantity}
                                        onChange={(e) => handlePalletChange(idx, 'quantity', e.target.value)}
                                        className="w-full bg-white border border-emerald-100 rounded-lg px-3 py-2 text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                                </div>
                            </div>
                            {pallets.length > 1 && (
                                <button onClick={() => removePallet(idx)}
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-red-100 text-red-400 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 shadow-sm transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50">
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                </div>
            </div>

            {/* ===== DOCUMENT CHECKLIST ===== */}
            {(() => {
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const uploadedTypes = documents.map(d => normalize(d.document_type || ''));
                const allCategories = [
                    ...DOCUMENT_CATEGORIES,
                    ...(isThaiGacp ? [{
                        id: 'gacp-standard', name: 'GACP Certification',
                        types: [{ id: 'thai-gacp-certificate-standard', name: 'Thai GACP Certificate' }]
                    }] : [{
                        id: 'gacp-farm', name: 'GACP Certification (Farm)',
                        types: [
                            { id: 'farm-purchase-order', name: 'Farm Purchase Order' },
                            { id: 'farm-commercial-invoice', name: 'Farm Commercial Invoice' },
                            { id: 'thai-gacp-certificate-farm', name: 'Thai GACP Certificate (Farm)' }
                        ]
                    }])
                ];
                const processed = allCategories.map(cat => {
                    const types = cat.types.map(type => ({
                        ...type,
                        isUploaded: uploadedTypes.some(u => u === normalize(type.id))
                    }));
                    return { ...cat, types, uploadedCount: types.filter(t => t.isUploaded).length };
                });
                const totalTypes = processed.reduce((s, c) => s + c.types.length, 0);
                const totalUploaded = processed.reduce((s, c) => s + c.uploadedCount, 0);
                const allDone = totalUploaded === totalTypes;

                return (
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${allDone ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                    {allDone
                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        : <FileText className="w-5 h-5 text-amber-600" />
                                    }
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-gray-900">Document Checklist</span>
                                    <p className="text-[10px] text-gray-400">
                                        {allDone ? 'All documents uploaded!' : `${totalUploaded} of ${totalTypes} documents uploaded`}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${allDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {totalUploaded} / {totalTypes}
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${totalTypes > 0 ? (totalUploaded / totalTypes) * 100 : 0}%` }}
                            />
                        </div>

                        <div className="space-y-3">
                            {processed.map(cat => {
                                const missing = cat.types.filter(t => !t.isUploaded);
                                const catDone = missing.length === 0;
                                return (
                                    <div key={cat.id} className={`rounded-xl p-3 border transition-all ${catDone ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {catDone
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                : <div className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /></div>
                                            }
                                            <span className="text-xs font-bold text-gray-700">{cat.name}</span>
                                            <span className={`ml-auto text-[9px] font-bold ${catDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {cat.uploadedCount}/{cat.types.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 ml-6">
                                            {cat.types.map(type => (
                                                <span
                                                    key={type.id}
                                                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${type.isUploaded
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-red-50 text-red-600 border-red-100'
                                                        }`}
                                                >
                                                    {type.isUploaded ? '✓' : '✗'} {type.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* ===== DOCUMENTS UPLOAD (Collapsed) ===== */}
            <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-5 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                            <Upload className="w-4.5 h-4.5 text-emerald-600" />
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-bold text-gray-900">Upload Documents</span>
                            <p className="text-[10px] text-gray-400">Upload required export documents for this shipment</p>
                        </div>
                        {uploadQueue.length > 0 && (
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded-full font-bold">{uploadQueue.length} QUEUED</span>
                        )}
                    </div>
                    {docsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="mt-3 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                        {[
                            ...DOCUMENT_CATEGORIES,
                            { id: 'gacp-certification', name: 'Thai GACP or GACP Certificate', types: isThaiGacp ? GACP_DOCS_FARM : GACP_DOCS_STANDARD }
                        ].map(category => (
                            <Collapsible key={category.id} open={openSections[category.id]}
                                onOpenChange={(open) => setOpenSections(prev => ({ ...prev, [category.id]: open }))}
                                className="border rounded-xl overflow-hidden bg-white border-gray-100">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50/50 hover:bg-emerald-50/20 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-xs font-bold text-gray-600">{category.name}</span>
                                        {(() => {
                                            const count = uploadQueue.filter(item => category.types.some(t => t.id === item.documentType)).length;
                                            return count > 0 ? <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-700 rounded-full font-bold">{count}</span> : null;
                                        })()}
                                    </div>
                                    {openSections[category.id] ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="p-4 space-y-4">
                                        {category.id === 'gacp-certification' && (
                                            <div className="flex items-start space-x-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                                                <Leaf className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                                <div className="flex-1">
                                                    <Label htmlFor={`gacp-${id}`} className="text-xs font-bold text-emerald-900 cursor-pointer">
                                                        Using GACP from another farm
                                                    </Label>
                                                    <p className="text-[10px] text-emerald-700 opacity-80">Check if purchased from another farm</p>
                                                </div>
                                                <Checkbox id={`gacp-${id}`} checked={isThaiGacp}
                                                    onCheckedChange={(checked) => setIsThaiGacp(!!checked)}
                                                    className="h-4 w-4 border-emerald-300 data-[state=checked]:bg-emerald-600" />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {category.types.map((docType) => {
                                                const isUploaded = documents.some(d => d.document_type === docType.id);
                                                return (
                                                    <div key={docType.id} className="flex flex-col space-y-1.5 p-3 bg-gray-50/30 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors">
                                                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                                            {isUploaded && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                                            {docType.name}
                                                            <span className="text-red-400 font-bold">*</span>
                                                        </Label>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="relative flex-1">
                                                                <input type="file" id={`${docType.id}-${id}`} className="sr-only"
                                                                    onChange={(e) => handleFileUpload(e.target.files, docType.id, docType.name)}
                                                                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" />
                                                                <label htmlFor={`${docType.id}-${id}`}
                                                                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:border-emerald-500 cursor-pointer transition-all shadow-sm">
                                                                    <span className="truncate flex-1">
                                                                        {uploadQueue.find(uq => uq.documentType === docType.id)?.file.name || 'Select file...'}
                                                                    </span>
                                                                    <Upload className="w-3 h-3 opacity-50" />
                                                                </label>
                                                            </div>
                                                            <button type="button" onClick={() => handlePreview(docType.id, docType.name)}
                                                                disabled={previewLoading[docType.id]}
                                                                className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg border border-gray-100 shadow-sm transition-all shrink-0"
                                                                title="View Template">
                                                                {previewLoading[docType.id] ? <Loader2 className="w-3 h-3 animate-spin text-emerald-500" /> : <Eye className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}

                        {/* Upload Queue */}
                        {uploadQueue.length > 0 && (
                            <div className="space-y-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Queue ({uploadQueue.length})</span>
                                    </div>
                                    <button onClick={() => setUploadQueue([])} className="text-[10px] text-red-400 font-bold hover:text-red-500">Clear All</button>
                                </div>
                                <div className="space-y-1.5">
                                    {uploadQueue.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-emerald-50/20 rounded-xl border border-emerald-50/50">
                                            <div className="flex items-center gap-3">
                                                <FileIcon mimeType={item.file.type} />
                                                <div>
                                                    <div className="text-xs font-bold text-gray-900 truncate max-w-[250px]">{item.file.name}</div>
                                                    <div className="text-[9px] text-emerald-600 font-bold uppercase">{item.documentTypeName}</div>
                                                </div>
                                            </div>
                                            <button onClick={() => setUploadQueue(prev => prev.filter(x => x.id !== item.id))}
                                                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-lg transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={submitAllDocuments} disabled={uploading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50">
                                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><CheckCircle2 className="w-4 h-4" /> Submit All ({uploadQueue.length} Files)</>}
                                </button>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* ===== SUBMITTED DOCUMENTS (Collapsed) ===== */}
            {documents.length > 0 && (
                <Collapsible open={submittedOpen} onOpenChange={setSubmittedOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-5 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-colors shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                                <FileText className="w-4.5 h-4.5 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <span className="text-sm font-bold text-gray-900">Submitted Documents</span>
                                <p className="text-[10px] text-gray-400">View status of uploaded documents</p>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-bold">{documents.length}</span>
                        </div>
                        {submittedOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="mt-3 bg-white rounded-xl border border-gray-100 p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-emerald-200 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 shrink-0 group-hover:bg-emerald-50 transition-colors">
                                                <FileIcon mimeType={doc.mime_type} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-xs font-bold text-gray-900 truncate">{doc.file_name}</div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[9px] text-emerald-600/80 font-bold uppercase truncate max-w-[80px]">{doc.document_type}</span>
                                                    <span className="text-[9px] text-gray-300">&bull;</span>
                                                    <span className="text-[9px] text-gray-400">
                                                        {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <DocStatusBadge status={doc.status || 'submitted'} />
                                            {doc.file_url && (
                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-emerald-600 hover:text-white transition-all">
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {/* Footer */}
            <div className="text-center pb-8">
                <span className="text-[10px] text-gray-400">Last updated: {formatDate(q.updated_at || q.created_at)}</span>
            </div>
        </div>
    );
}
