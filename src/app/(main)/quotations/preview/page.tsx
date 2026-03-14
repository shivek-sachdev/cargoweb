'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FileText, Edit, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Quotation, getQuotationById } from '@/lib/db';

// Define interfaces for data coming from sessionStorage
interface EnhancedQuotation extends Quotation {
  // Additional fields that might be added by handleViewQuotation
  totalFreightCost?: number;
  totalVolumeWeight?: number;
  totalActualWeight?: number;
  chargeableWeight?: number;
  clearanceCost?: number;
  deliveryCost?: number;
  freightRate?: number;
}

interface PalletWithQuantity {
  length: number | string;
  width: number | string;
  height: number | string;
  weight: number | string;
  quantity?: number | string;
}

interface ChargeItem {
  name: string;
  description: string;
  amount: number | string;
}

// Add a function to format numbers consistently
const formatNumber = (num: number | string | undefined | null) => {
  if (num === undefined || num === null) return "0.00";
  const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(parsedNum)) return "0.00";
  return parsedNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Wrapper component to handle Suspense
export default function QuotationPreviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
      <QuotationPreviewContent />
    </Suspense>
  );
}

function QuotationPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotationData, setQuotationData] = useState<EnhancedQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const quotationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadQuotation = async () => {
      try {
        // Check for ID in URL first
        const quotationId = searchParams.get('id');

        if (quotationId) {
          // Fetch from database
          console.log('Fetching quotation from database:', quotationId);
          const dbQuotation = await getQuotationById(quotationId);
          if (dbQuotation) {
            setQuotationData(dbQuotation as EnhancedQuotation);
            setLoading(false);
            return;
          }
        }

        // Fallback to sessionStorage
        const storedData = sessionStorage.getItem('quotationData');
        if (storedData) {
          setQuotationData(JSON.parse(storedData));
        } else {
          // No data found
          console.warn('No quotation data found');
        }
      } catch (error) {
        console.error('Error retrieving quotation data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuotation();
  }, [searchParams]);

  const handleSaveAsPdf = () => {
    // ใช้วิธีเดียวกับการพิมพ์ปกติซึ่งจะรักษารูปแบบได้สมบูรณ์
    window.print();
  };

  const editQuotation = () => {
    if (!quotationData || !quotationData.id) return;
    // Store data in sessionStorage before navigating to edit page
    sessionStorage.setItem('quotationDataForEdit', JSON.stringify(quotationData));
    router.push(`/quotations/new?id=${quotationData.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-pulse text-lg">Loading quotation data...</div>
      </div>
    );
  }

  if (!quotationData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-red-600">Failed to load quotation data.</p>
        <Link href="/quotations">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate weights
  const calculateTotalActualWeight = () => {
    if (!quotationData?.pallets?.length) return 0;

    return quotationData.pallets.reduce((total: number, pallet: PalletWithQuantity) => {
      const weight = typeof pallet.weight === 'number' ? pallet.weight : parseFloat(pallet.weight) || 0;
      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(String(pallet.quantity)) || 1;
      return total + (weight * quantity);
    }, 0);
  };

  const calculateTotalVolumeWeight = () => {
    if (!quotationData?.pallets?.length) return 0;

    return quotationData.pallets.reduce((total: number, pallet: PalletWithQuantity) => {
      const length = typeof pallet.length === 'number' ? pallet.length : parseFloat(pallet.length) || 0;
      const width = typeof pallet.width === 'number' ? pallet.width : parseFloat(pallet.width) || 0;
      const height = typeof pallet.height === 'number' ? pallet.height : parseFloat(pallet.height) || 0;
      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(String(pallet.quantity)) || 1;

      return total + ((length * width * height * quantity) / 6000);
    }, 0);
  };

  const totalActualWeight = quotationData.total_actual_weight || calculateTotalActualWeight();
  const totalVolumeWeight = quotationData.total_volume_weight || calculateTotalVolumeWeight();
  const chargeableWeight = quotationData.chargeable_weight || Math.max(totalActualWeight, Math.ceil(totalVolumeWeight));

  // ใช้ค่าจาก quotationData แบบ camelCase (จากหน้าคำนวณ) หรือ snake_case (จากฐานข้อมูล)
  const totalFreightCost = quotationData.totalFreightCost !== undefined ? quotationData.totalFreightCost :
    (quotationData.total_freight_cost !== undefined ? quotationData.total_freight_cost : 0);

  const clearanceCost = quotationData.clearanceCost !== undefined ? quotationData.clearanceCost :
    (quotationData.clearance_cost !== undefined ? quotationData.clearance_cost : 0);

  const deliveryCost = quotationData.delivery_service_required ?
    (quotationData.deliveryCost !== undefined ? quotationData.deliveryCost :
      (quotationData.delivery_cost !== undefined ? quotationData.delivery_cost : 3500)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/quotations">
            <Button variant="outline" size="icon" className="print:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Quotation Preview</h1>
          {/* Removed status badge as it's always 'Ready to Submit' */}
          {/* <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Ready to Submit</span> */}
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href="/quotations">
            <Button variant="outline" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Main Page
            </Button>
          </Link>
          <Button onClick={handleSaveAsPdf}>
            <FileText className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
        </div>
      </div>

      <div ref={quotationRef} id="quotation-content">
        <Card className="p-8 max-w-4xl mx-auto bg-white shadow-sm print:shadow-none print:border-none print:p-0">
          <CardContent className="p-0">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">QUOTATION</h2>
                <div className="text-sm text-slate-500 mt-1">Ref: {quotationData?.quotation_no || quotationData?.id || 'N/A'}</div>
              </div>
              <div className="text-right">
                {/* <div className="text-sm text-slate-500">Prepared by</div> */}
                <div className="text-xl font-bold text-slate-900">OMGEXP Cargo Portal</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">CLIENT INFORMATION</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1 font-medium">Company:</td>
                      <td className="py-1">{quotationData?.company_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium">Contact Person:</td>
                      <td className="py-1">{quotationData?.contact_person || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium">Contract No:</td>
                      <td className="py-1">{quotationData?.contract_no || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">SHIPPING DETAILS</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1 font-medium">Quotation Date:</td>
                      <td className="py-1">{quotationData?.created_at ? new Date(quotationData.created_at).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium">Destination:</td>
                      <td className="py-1">{quotationData?.destination || 'N/A'}</td>
                    </tr>
                    {quotationData?.requested_destination && (!quotationData.destination || quotationData.destination === 'N/A') && (
                      <tr>
                        <td className="py-1 font-medium text-emerald-700">Requested:</td>
                        <td className="py-1 text-emerald-700 font-medium italic">{quotationData.requested_destination}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">PALLET INFORMATION</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">#</th>
                    <th className="py-2 text-left">Dimensions (L×W×H cm)</th>
                    <th className="py-2 text-left">Actual Weight (kg)</th>
                    <th className="py-2 text-left">Volume Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationData?.pallets && quotationData.pallets.map((pallet: PalletWithQuantity, index: number) => {
                    const volumeWeight = ((Number(pallet.length) * Number(pallet.width) * Number(pallet.height)) / 6000);
                    return (
                      <tr key={index} className="border-b">
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2">{pallet.length} × {pallet.width} × {pallet.height}</td>
                        <td className="py-2">{pallet.weight}</td>
                        <td className="py-2">{Math.round(volumeWeight)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-b">
                    <td colSpan={2} className="py-2 font-medium">Total</td>
                    <td className="py-2">{totalActualWeight} kg</td>
                    <td className="py-2">{Math.ceil(totalVolumeWeight)} kg</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="py-2 font-medium">Chargeable Weight</td>
                    <td colSpan={2} className="py-2">{Math.ceil(chargeableWeight)} kg</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-8">
              <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">SERVICES & CHARGES</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Amount (THB)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Freight Cost</td>
                    <td className="py-2 text-right">{formatNumber(totalFreightCost)}</td>
                  </tr>
                  {(clearanceCost || 0) > 0 && (
                    <tr className="border-b">
                      <td className="py-2">Clearance Cost</td>
                      <td className="py-2 text-right">{formatNumber(clearanceCost)}</td>
                    </tr>
                  )}
                  {quotationData?.delivery_service_required && (
                    <tr className="border-b">
                      <td className="py-2">Delivery Service ({quotationData?.delivery_vehicle_type || 'N/A'})</td>
                      <td className="py-2 text-right">{formatNumber(deliveryCost)}</td>
                    </tr>
                  )}
                  {quotationData?.additional_charges && quotationData.additional_charges.map((charge: ChargeItem, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">Additional: {charge.description}</td>
                      <td className="py-2 text-right">{formatNumber(charge.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Cost</td>
                    <td className="py-2 text-right">{formatNumber(quotationData?.total_cost || 0)} THB</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {quotationData?.notes && (
              <div className="mb-8">
                <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">NOTES</h3>
                <div className="text-sm">{quotationData.notes}</div>
              </div>
            )}

            {/* Bank Account Information */}
            <div className="mb-8">
              <h3 className="font-semibold bg-gray-100 px-2 py-1 mb-3 uppercase text-sm">PAYMENT INFORMATION</h3>
              <div className="text-sm space-y-1">
                <p><strong>Kindly transfer to the following account:</strong></p>
                <p><strong>Bank:</strong> KASIKORN BANK</p>
                <p><strong>Account Name:</strong> Mr. Shivek Sachdev</p>
                <p><strong>Account Number:</strong> 784-2-02905-2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6 print:hidden">
        <div className="flex gap-2">
          {/* Add Document Upload button */}
          <Button
            onClick={() => router.push(`/documents-upload/${quotationData?.id}?company=${encodeURIComponent(quotationData?.company_name || '')}&destination=${encodeURIComponent(quotationData?.destination || '')}`)}
            variant="outline"
            className="h-9"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
          <Button
            onClick={editQuotation}
            variant="outline"
            className="h-9"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
} 