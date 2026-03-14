'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Plane, Package, MapPin, CalendarDays,
    CheckCircle2, Inbox, Loader2, FileText,
    Search, ArrowRight, Eye, Clock, PlusCircle
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { getCustomerQuotations, getCustomerPendingRequests } from '@/lib/customer-db';
import type { Quotation } from '@/lib/db';

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
    if (status === 'completed') return { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5, barColor: 'bg-emerald-500' };
    if (status === 'Shipped') return { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4, barColor: 'bg-blue-500' };
    const stageMap: Record<string, { label: string; color: string; bgColor: string; step: number; barColor: string }> = {
        new: { label: 'New', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200', step: 1, barColor: 'bg-slate-400' },
        under_review: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2, barColor: 'bg-amber-500' },
        pending_booking: { label: 'Pending Booking', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', step: 3, barColor: 'bg-purple-500' },
        booking_confirmed: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4, barColor: 'bg-blue-500' },
        delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5, barColor: 'bg-emerald-500' },
        cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', step: 0, barColor: 'bg-red-500' },
        on_hold: { label: 'On Hold', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', step: 2, barColor: 'bg-yellow-500' },
        pending_docs: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2, barColor: 'bg-amber-500' },
        documents_submitted: { label: 'Under Review', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', step: 2, barColor: 'bg-amber-500' },
        payment_received: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', step: 5, barColor: 'bg-emerald-500' },
        awb_received: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4, barColor: 'bg-blue-500' },
        booking_requested: { label: 'Booking Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', step: 4, barColor: 'bg-blue-500' },
    };
    return stageMap[stage || ''] || { label: 'New', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200', step: 0, barColor: 'bg-slate-400' };
}

// ============ MINI PROGRESS BAR ============

function MiniProgress({ step }: { step: number }) {
    return (
        <div className="flex items-center gap-1 w-full max-w-[140px]">
            {[1, 2, 3, 4, 5].map((s) => (
                <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-all ${s <= step
                        ? step === 5 ? 'bg-emerald-500' : 'bg-blue-500'
                        : 'bg-gray-100'
                        }`}
                />
            ))}
        </div>
    );
}

// ============ SHIPMENT LIST CARD ============

function ShipmentListCard({ q }: { q: Quotation }) {
    const sc = getStageDisplay(q.opportunities?.stage, q.status);

    return (
        <Link
            href={`/portal/shipments/${q.id}`}
            className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-200 transition-all group"
        >
            <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Icon + Info */}
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${sc.step === 5 ? 'bg-emerald-50 text-emerald-600' : sc.step >= 4 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                            <Plane className={`w-6 h-6 ${sc.step >= 4 ? 'animate-bounce' : ''}`} />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-base font-bold text-gray-900">{q.quotation_no || q.id.slice(0, 8)}</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${sc.bgColor} ${sc.color}`}>
                                    {sc.step === 4 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />}
                                    {sc.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                                    <MapPin className="w-3.5 h-3.5" /> {q.destination || 'N/A'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Package className="w-3.5 h-3.5 text-gray-400" /> {q.pallets?.length || 0} pallets
                                </span>
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> {formatDate(q.created_at)}
                                </span>
                            </div>
                            {/* Mini progress */}
                            <div className="pt-1">
                                <MiniProgress step={sc.step} />
                            </div>
                        </div>
                    </div>

                    {/* Right: Amount + Arrow */}
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0 self-end sm:self-center">
                        <div className="text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total</div>
                            <div className="text-lg font-black text-gray-900">{formatAmount(q.total_cost)}</div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-emerald-100 group-hover:text-emerald-600 text-gray-400 transition-all">
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50/50 border-t border-gray-50 px-5 py-2 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">
                    Updated: {formatDate(q.updated_at || q.created_at)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3 h-3" /> View Details
                </span>
            </div>
        </Link>
    );
}

// ============ MAIN PAGE ============

export default function MyShipmentsPage() {
    const { user, profile, isLoading: authLoading } = useCustomerAuth();
    const displayName = profile?.full_name || profile?.company || 'Customer';
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Quotation[]>([]);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [quots, pending] = await Promise.all([
                getCustomerQuotations(user.id),
                getCustomerPendingRequests(user.id),
            ]);
            // Filter out pending_approval from main list (they show in separate section)
            setQuotations(quots.filter(q => q.status !== 'pending_approval'));
            setPendingRequests(pending);
        } catch (err) {
            console.error('[MyShipments] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) { setLoading(false); return; }
        loadData();
    }, [user?.id, authLoading, loadData]);

    const filtered = quotations.filter(q => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const qNo = (q.quotation_no || '').toLowerCase();
        const dest = (q.destination || '').toLowerCase();
        const company = (q.company_name || '').toLowerCase();
        return qNo.includes(query) || dest.includes(query) || company.includes(query);
    });

    const stats = useMemo(() => {
        const total = quotations.length;
        const active = quotations.filter(q => {
            const s = getStageDisplay(q.opportunities?.stage, q.status);
            return s.step > 0 && s.step < 4;
        }).length;
        const shipped = quotations.filter(q => {
            const s = getStageDisplay(q.opportunities?.stage, q.status);
            return s.step === 4;
        }).length;
        const delivered = quotations.filter(q => {
            const s = getStageDisplay(q.opportunities?.stage, q.status);
            return s.step === 5;
        }).length;
        return { total, active, shipped, delivered };
    }, [quotations]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Shipments</h1>
                    <p className="text-sm text-gray-500 mt-1">Track and manage all your shipments, {displayName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/portal/quotations/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <PlusCircle className="w-4 h-4" /> Request Quote
                    </Link>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Live</span>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: stats.total, icon: FileText, color: 'emerald' },
                    { label: 'In Progress', value: stats.active, icon: Package, color: 'amber' },
                    { label: 'Shipped', value: stats.shipped, icon: Plane, color: 'blue' },
                    { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'violet' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-50' : s.color === 'amber' ? 'bg-amber-50' : s.color === 'blue' ? 'bg-blue-50' : 'bg-violet-50'
                                }`}>
                                <s.icon className={`w-4 h-4 ${s.color === 'emerald' ? 'text-emerald-600' : s.color === 'amber' ? 'text-amber-600' : s.color === 'blue' ? 'text-blue-600' : 'text-violet-600'
                                    }`} />
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-300" /> : s.value}
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium">{s.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by quotation number, destination..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
            </div>

            {/* Pending Quote Requests */}
            {!loading && pendingRequests.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Quote Requests ({pendingRequests.length})
                    </h2>
                    {pendingRequests.map((q) => (
                        <div
                            key={q.id}
                            className="bg-amber-50/50 rounded-2xl border border-amber-100 p-5"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="text-base font-bold text-gray-900">
                                                {q.quotation_no || q.id.slice(0, 8)}
                                            </span>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 border-amber-200 text-amber-700">
                                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse" />
                                                Pending Approval
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3.5 h-3.5 text-gray-400" /> {q.pallets?.length || 0} pallet type(s)
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> {formatDate(q.created_at)}
                                            </span>
                                        </div>
                                        {q.notes && (
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">Note: {q.notes}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs text-amber-600 font-semibold">Awaiting staff review</div>
                                    <div className="text-[10px] text-gray-400 mt-1">
                                        Destination & pricing will be set by our team
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Shipment List */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-100 flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100">
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                            <Inbox className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {quotations.length === 0 ? 'No shipments yet' : 'No matching results'}
                        </h3>
                        <p className="text-sm text-gray-500 max-w-[320px]">
                            {quotations.length === 0
                                ? 'Your shipments will appear here once our team assigns quotations to your account.'
                                : 'Try adjusting your search query.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((q) => (
                        <ShipmentListCard key={q.id} q={q} />
                    ))}
                    <div className="text-center pt-2">
                        <span className="text-xs text-gray-400">
                            Showing {filtered.length} of {quotations.length} shipments
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
