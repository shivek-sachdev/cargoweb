'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { getQuotationById, Quotation } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DebitNote {
  id?: string;
  quotation_id: string;
  debit_note_no: string;
  date_of_issue: string;
  remarks: string;
  created_at?: string;
  updated_at?: string;
}

export default function DebitNotePage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Generate Debit Note Number: HIF-yymmdd-Random
  const generateDebitNoteNumber = useCallback(() => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 9000) + 1000; // 4-digit random number
    return `HIF-${yy}${mm}${dd}-${random}`;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load quotation
      const quotationData = await getQuotationById(quotationId);
      if (!quotationData) {
        toast.error('Quotation not found');
        router.push('/quotations');
        return;
      }
      setQuotation(quotationData);

      // Check if debit note exists
      const { data: existingDebitNote } = await supabase
        .from('debit_notes')
        .select('*')
        .eq('quotation_id', quotationId)
        .single();

      if (existingDebitNote) {
        setDebitNote(existingDebitNote);
        setRemarks(existingDebitNote.remarks || '');
      } else {
        // Create new debit note structure with generated number
        const newDebitNote: DebitNote = {
          quotation_id: quotationId,
          debit_note_no: generateDebitNoteNumber(),
          date_of_issue: new Date().toISOString().split('T')[0],
          remarks: ''
        };
        setDebitNote(newDebitNote);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [quotationId, router, generateDebitNoteNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveDebitNote = async () => {
    if (!debitNote) return;

    try {
      setSaving(true);

      const debitNoteData = {
        quotation_id: quotationId,
        debit_note_no: debitNote.debit_note_no,
        date_of_issue: debitNote.date_of_issue,
        remarks: remarks
      };

      if (debitNote.id) {
        // Update existing
        const { error } = await supabase
          .from('debit_notes')
          .update(debitNoteData)
          .eq('id', debitNote.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('debit_notes')
          .insert([debitNoteData])
          .select()
          .single();

        if (error) throw error;
        setDebitNote(data);
      }

      toast.success('Debit Note saved successfully');
    } catch (error) {
      console.error('Error saving debit note:', error);
      toast.error('Failed to save Debit Note');
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = () => {
    if (!quotation || !debitNote) return;

    // Open print view in new tab with debit note number
    const printUrl = `/debit-note/print/${quotationId}?remarks=${encodeURIComponent(remarks)}&debitNoteNo=${encodeURIComponent(debitNote.debit_note_no)}`;
    window.open(printUrl, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateTotalActualWeight = () => {
    if (!quotation?.pallets?.length) return 0;
    if (quotation.total_actual_weight) return quotation.total_actual_weight;

    return quotation.pallets.reduce((total, pallet) => {
      const weight = typeof pallet.weight === 'number' ? pallet.weight : parseFloat(pallet.weight) || 0;
      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(pallet.quantity) || 1;
      return total + (weight * quantity);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!quotation || !debitNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Quotation not found</p>
          <Button onClick={() => router.push('/quotations')}>
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Debit Note</h1>
            <p className="text-sm text-gray-600">Quotation No: {quotation.quotation_no || quotation.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={saveDebitNote}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            onClick={generatePDF}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Debit Note Preview */}
      <Card className="mb-6">
        <CardContent className="p-8">
          {/* Company Header with Logo */}
          <div className="flex items-center mb-8 border-b pb-6">
            {/* Logo */}
            <div className="flex-shrink-0 mr-6">
              <Image
                src="/icons/handle-logo.png"
                alt="Handle Inter Freight Logistics"
                width={160}
                height={160}
                className="h-40 w-auto"
              />
            </div>

            {/* Company Info */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-blue-800">Handle Inter Freight Logistics Co., Ltd.</h2>
              <p className="text-sm text-gray-600 mt-2">
                132/15,16 Soi Ramkhamhaeng 24 (Seri Village), Huamark, Bangkapi, Bangkok 10250<br />
                Tel. +66 (0) 2253-5995 (5 auto lines) Fax : +66 (0) 2653-6885
              </p>
            </div>
          </div>

          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Left Side - To/From */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">DEBIT NOTE</h3>
              </div>

              <div>
                <p className="font-semibold">To:</p>
                <p className="text-sm">{quotation.company_name}</p>
                {quotation.customer_name && (
                  <p className="text-sm">Customer: {quotation.customer_name}</p>
                )}
              </div>

              <div>
                <p className="font-semibold">From:</p>
                <p className="text-sm">
                  HANDLE INTER FREIGHT LOGISTICS Co.,Ltd. (HEAD OFFICE)<br />
                  132/15,16 SOI RAMKHAMHAENG 24 (SERI VILLAGE), HUAMARK,<br />
                  BANGKAPI, BANGKOK 10250
                </p>
              </div>
            </div>

            {/* Right Side - Debit Note Details */}
            <div className="space-y-4">
              <div>
                <p className="font-semibold">DEBIT NOTE NO.:</p>
                <p className="text-sm font-mono">{debitNote.debit_note_no}</p>
              </div>

              <div>
                <p className="font-semibold">Date of Issue:</p>
                <p className="text-sm">{formatDate(debitNote.date_of_issue)}</p>
              </div>

              <div>
                <p className="font-semibold">Destination:</p>
                <p className="text-sm">{quotation.destination}</p>
              </div>
            </div>
          </div>

          {/* Pallet Information */}
          {quotation.pallets && quotation.pallets.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 bg-gray-100 px-3 py-2 rounded">PALLET INFORMATION</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-3 py-2 text-left">#</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Dimensions (L×W×H cm)</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Qty</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Weight (kg)</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Total Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.pallets.map((pallet, index) => {
                      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(pallet.quantity) || 1;
                      const weight = typeof pallet.weight === 'number' ? pallet.weight : parseFloat(pallet.weight) || 0;
                      const totalWeight = weight * quantity;

                      return (
                        <tr key={index}>
                          <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                          <td className="border border-gray-300 px-3 py-2">
                            {pallet.length} × {pallet.width} × {pallet.height}
                          </td>
                          <td className="border border-gray-300 px-3 py-2">{quantity}</td>
                          <td className="border border-gray-300 px-3 py-2">{weight}</td>
                          <td className="border border-gray-300 px-3 py-2">{totalWeight}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right">Total Actual Weight:</td>
                      <td className="border border-gray-300 px-3 py-2">{calculateTotalActualWeight()} kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charges Table */}
          <div className="mb-6">
            <h4 className="font-semibold mb-3 bg-gray-100 px-3 py-2 rounded">CHARGES</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left">Description</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Amount (THB)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Freight Cost */}
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">
                      Freight Cost - From Bangkok to {quotation.destination}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {formatCurrency(quotation.total_freight_cost || 0)}
                    </td>
                  </tr>

                  {/* Delivery Cost */}
                  {quotation.delivery_service_required && quotation.delivery_cost && quotation.delivery_cost > 0 && (
                    <tr>
                      <td className="border border-gray-300 px-3 py-2">
                        Delivery Service ({quotation.delivery_vehicle_type?.toUpperCase()})
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(quotation.delivery_cost)}
                      </td>
                    </tr>
                  )}

                  {/* Clearance Cost */}
                  {quotation.clearance_cost && quotation.clearance_cost > 0 && (
                    <tr>
                      <td className="border border-gray-300 px-3 py-2">Clearance & Handling Fee</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(quotation.clearance_cost)}
                      </td>
                    </tr>
                  )}

                  {/* Additional Charges */}
                  {quotation.additional_charges && quotation.additional_charges.length > 0 &&
                    quotation.additional_charges.map((charge, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-3 py-2">{charge.description}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {formatCurrency(typeof charge.amount === 'number' ? charge.amount : parseFloat(charge.amount) || 0)}
                        </td>
                      </tr>
                    ))
                  }

                  {/* Total */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-300 px-3 py-2">TOTAL</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {formatCurrency(quotation.total_cost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Information */}
          <div className="border-t pt-6 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="font-semibold">PREPARING BY:</p>
                <p>MONTREE C.</p>
              </div>

              <div className="space-y-2">
                <p><span className="font-semibold">Company Name:</span> Handle Inter Freight Logistics Co.,Ltd.</p>
                <p><span className="font-semibold">Bank Name:</span> Kasikorn Bank Public Co.,Ltd.</p>
                <p><span className="font-semibold">Branch:</span> Thanon Phetchaburi 17</p>
                <p><span className="font-semibold">Bank Address:</span> 745/23-25 Petchaburi Rd., Thanonphayathai, Rajchathevee,Bangkok 10400 Thailand</p>
                <p><span className="font-semibold">Account Number:</span> 771-2-02000-2</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remarks Section */}
      <Card>
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="remarks">Additional Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              placeholder="Enter any additional remarks or notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
