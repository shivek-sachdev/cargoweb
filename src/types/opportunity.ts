// Simplified air freight shipment pipeline (5 main stages)
export type OpportunityStage =
    | 'new'
    | 'under_review'
    | 'pending_booking'
    | 'booking_confirmed'
    | 'delivered'
    | 'cancelled'
    | 'on_hold';

export type ClosureStatus = 'won' | 'lost' | null;

export interface Opportunity {
    id: string;
    topic: string;
    customerName: string;
    companyId?: string;
    companyName: string;
    amount: number;
    currency: string;
    stage: OpportunityStage;
    probability: number;
    closeDate: string;
    ownerName: string;
    createdAt: string;
    updatedAt: string;

    vehicleType?: string;
    containerSize?: string;
    productDetails?: string;
    notes?: string;
    destinationId?: string;
    destinationName?: string;
    productId?: string[];
    productName?: string[];

    quotationIds?: string[];
    closureStatus?: 'won' | 'lost' | null;
    focusColor?: string | null;
    sortOrder?: number | null;
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
    new: 'New',
    under_review: 'Under Review',
    pending_booking: 'Pending Booking',
    booking_confirmed: 'Booking Confirmed',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    on_hold: 'On Hold',
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
    new: 'bg-slate-100 text-slate-700 border-slate-200',
    under_review: 'bg-amber-50 text-amber-700 border-amber-200',
    pending_booking: 'bg-purple-50 text-purple-700 border-purple-200',
    booking_confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    on_hold: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

// Main pipeline stages for Kanban (5 core + 2 special)
export const PIPELINE_STAGES: OpportunityStage[] = [
    'new',
    'under_review',
    'pending_booking',
    'booking_confirmed',
    'delivered',
    'on_hold',
    'cancelled',
];
