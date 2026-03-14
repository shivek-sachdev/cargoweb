-- Migration: Simplified air freight status pipeline (5 main stages)
-- new -> under_review -> pending_booking -> booking_confirmed -> delivered

UPDATE public.opportunities
SET stage = CASE
    WHEN stage IN ('delivered', 'closed', 'payment_received') THEN 'delivered'
    WHEN stage IN ('awb_issued', 'awb_received', 'cargo_received', 'in_transit', 'customs_clearance', 'booking_requested') THEN 'booking_confirmed'
    WHEN stage = 'pending_booking' THEN 'pending_booking'
    WHEN stage IN ('pending_docs', 'documents_submitted') THEN 'under_review'
    WHEN stage IN ('new', 'under_review', 'booking_confirmed', 'cancelled', 'on_hold') THEN stage
    ELSE 'new'
END
WHERE stage IS NOT NULL;
