'use client';

import { useState, useEffect } from 'react';
import { getQuotationById, Quotation } from '@/lib/db';
import { useParams } from 'next/navigation';

// Define interfaces locally instead of importing from db.ts
interface Pallet {
  length: number | string;
  width: number | string;
  height: number | string;
  weight: number | string;
  quantity: number | string;
}

interface AdditionalCharge {
  name: string;
  description: string;
  amount: number | string;
}

export default function PrintQuotationPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuotation() {
      try {
        // Try to get from the database
        const quotation = await getQuotationById(id);
        if (quotation) {
          console.log("Loaded quotation data:", JSON.stringify(quotation, null, 2)); // Detailed logging
          setData(quotation);
        } else {
          console.error('Quotation not found');
        }
      } catch (error) {
        console.error('Error fetching quotation:', error);
      } finally {
        setLoading(false);
        // Auto-trigger print when data is loaded
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }

    if (id) {
      fetchQuotation();
    }
  }, [id]);

  // Calculate volume weight
  const calculateVolumeWeight = (width: number, length: number, height: number, quantity: number) => {
    // Calculate volume in cubic centimeters
    const volumeCm3 = length * width * height * quantity;
    // Calculate volume weight by dividing by 6000 (industry standard)
    return volumeCm3 / 6000;
  };

  // Calculate actual weight
  const getTotalActualWeight = (): number => {
    if (!data?.pallets?.length) return 0;
    if (typeof data.total_actual_weight === 'number') return data.total_actual_weight;
    return data.pallets.reduce((total: number, pallet: Pallet) => {
      const weight = typeof pallet.weight === 'number' ? pallet.weight : parseFloat(pallet.weight) || 0;
      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(pallet.quantity) || 1;
      return total + (weight * quantity);
    }, 0);
  };

  // Calculate volume weight
  const getTotalVolumeWeight = (): number => {
    if (!data?.pallets?.length) return 0;
    if (typeof data.total_volume_weight === 'number') return data.total_volume_weight;
    return data.pallets.reduce((total: number, pallet: Pallet) => {
      const length = typeof pallet.length === 'number' ? pallet.length : parseFloat(pallet.length) || 0;
      const width = typeof pallet.width === 'number' ? pallet.width : parseFloat(pallet.width) || 0;
      const height = typeof pallet.height === 'number' ? pallet.height : parseFloat(pallet.height) || 0;
      const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(pallet.quantity) || 1;

      return total + calculateVolumeWeight(width, length, height, quantity);
    }, 0);
  };

  // Calculate chargeable weight (max of volume weight and actual weight)
  const getChargeableWeight = (): number => {
    if (typeof data?.chargeable_weight === 'number') return data.chargeable_weight;
    const totalActualWeight = getTotalActualWeight();
    const totalVolumeWeight = getTotalVolumeWeight();
    return Math.max(totalActualWeight, Math.ceil(totalVolumeWeight));
  };

  // Format number with commas
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null) return "0.00";
    const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(parsedNum)) return "0.00";
    return parsedNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate total cost
  const calculateTotalCost = (quotationData: Quotation | null): number => {
    if (typeof quotationData?.total_cost === 'number') return quotationData.total_cost;
    const fc: number = calculateFreightCost();
    const cc: number = calculateClearanceCost();
    const dc: number = calculateDeliveryCost();
    const ac: number = calculateAdditionalCharges();

    return fc + cc + dc + ac;
  };

  // Calculate the freight cost
  const calculateFreightCost = (): number => {
    if (typeof data?.total_freight_cost === 'number') return data.total_freight_cost;
    const total = typeof data?.total_cost === 'number' ? data.total_cost : 0;

    if (total > 0) {
      // If we have a total cost but no freight cost, estimate freight as 75% of total
      // This is a reasonable distribution for most shipping quotations
      return Math.round(total * 0.75);
    }

    // Otherwise estimate based on weight
    const chargeableWt = data?.chargeable_weight || getChargeableWeight();
    return Math.round(chargeableWt * 150); // Default rate of 150 THB per kg if nothing else works
  };

  // Calculate the clearance cost 
  const calculateClearanceCost = (): number => {
    if (typeof data?.clearance_cost === 'number') return data.clearance_cost;
    const total = typeof data?.total_cost === 'number' ? data.total_cost : 0;

    if (total > 0) {
      // Estimate clearance as roughly 10% of total if we have total but no breakdown
      return Math.round(total * 0.10);
    }

    // Otherwise return 0 (no clearance cost by default)
    return 0;
  };

  // Calculate the delivery cost
  const calculateDeliveryCost = (): number => {
    if (!data?.delivery_service_required) return 0;

    if (typeof data?.delivery_cost === 'number') return data.delivery_cost;
    const total = typeof data?.total_cost === 'number' ? data.total_cost : 0;

    if (total > 0) {
      // Estimate delivery as roughly 15% of total if we have total but no breakdown
      return Math.round(total * 0.15);
    }

    // Otherwise calculate based on vehicle type
    const vehicleType = data?.delivery_vehicle_type || '4wheel';
    return vehicleType === '4wheel' ? 3500 : 9500;
  };

  // Calculate total additional charges
  const calculateAdditionalCharges = (): number => {
    const charges = data?.additional_charges || [];
    return charges.reduce((total: number, charge: AdditionalCharge) => {
      const amount = typeof charge.amount === 'number' ? charge.amount : parseFloat(charge.amount) || 0;
      return total + amount;
    }, 0);
  };

  // Get current date for quotation if not provided
  const getQuotationDate = () => {
    // Use created_at only
    if (data?.created_at) {
      const date = new Date(data.created_at);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse text-lg">Loading quotation data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Quotation not found</div>
      </div>
    );
  }

  // Get all the calculated values
  const actualWeight = getTotalActualWeight();
  const volumeWeight = getTotalVolumeWeight();
  const chargeableWeight = getChargeableWeight();
  const freightCost = calculateFreightCost();
  const clearanceCost = calculateClearanceCost();
  const deliveryCost = calculateDeliveryCost();
  const totalCost = calculateTotalCost(data);

  return (
    <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen border rounded-lg shadow-sm print:shadow-none print:border-none">
      {/* Header with company and reference info */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QUOTATION</h1>
          <p className="text-sm text-slate-500">Ref: {data?.quotation_no || data?.id || 'N/A'}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-slate-900">OMGEXP Cargo Portal</div>
          <div className="text-sm text-slate-500">
            10/12-13 Convent Road, Silom, Bangrak,<br />
            Bangkok 10500
          </div>
        </div>
      </div>

      {/* Client and Shipping Information */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">CLIENT INFORMATION</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-medium">Company:</td>
                <td className="py-1">{data?.company_name || 'N/A'}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium">Customer Name:</td>
                <td className="py-1">{data?.customer_name || 'N/A'}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium">Contact Person:</td>
                <td className="py-1">{data?.contact_person || 'N/A'}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium">Contract No:</td>
                <td className="py-1">{data?.contract_no || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">SHIPPING DETAILS</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-medium">Quotation Date:</td>
                <td className="py-1">{getQuotationDate()}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium">Destination:</td>
                <td className="py-1">{data?.destination || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pallet Information */}
      <div className="mb-8">
        <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">PALLET INFORMATION</h3>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left border">#</th>
              <th className="py-2 px-4 text-left border">Dimensions (L×W×H cm)</th>
              <th className="py-2 px-4 text-left border">Actual Weight (kg)</th>
              <th className="py-2 px-4 text-left border">Volume Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {data?.pallets && data.pallets.length > 0 ? (
              data.pallets.map((pallet: Pallet, index: number) => {
                const length = typeof pallet.length === 'number' ? pallet.length : parseFloat(pallet.length) || 0;
                const width = typeof pallet.width === 'number' ? pallet.width : parseFloat(pallet.width) || 0;
                const height = typeof pallet.height === 'number' ? pallet.height : parseFloat(pallet.height) || 0;
                const quantity = typeof pallet.quantity === 'number' ? pallet.quantity : parseInt(pallet.quantity) || 1;
                const weight = typeof pallet.weight === 'number' ? pallet.weight : parseFloat(pallet.weight) || 0;

                const volumeWeight = calculateVolumeWeight(
                  width,
                  length,
                  height,
                  quantity
                );
                return (
                  <tr key={index} className="border-b">
                    <td className="py-2 px-4 border">{index + 1}</td>
                    <td className="py-2 px-4 border">{length} × {width} × {height}</td>
                    <td className="py-2 px-4 border">{weight}</td>
                    <td className="py-2 px-4 border">{Math.round(volumeWeight)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-2 px-4 text-center text-gray-500 italic">No pallet information available.</td>
              </tr>
            )}
            <tr className="bg-gray-50">
              <td colSpan={2} className="py-2 px-4 font-medium border">Total</td>
              <td className="py-2 px-4 border">{formatNumber(actualWeight)} kg</td>
              <td className="py-2 px-4 border">{formatNumber(Math.ceil(volumeWeight))} kg</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td colSpan={2} className="py-2 px-4 border">Chargeable Weight</td>
              <td colSpan={2} className="py-2 px-4 border">{formatNumber(Math.ceil(chargeableWeight))} kg</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Services & Charges */}
      <div className="mb-8">
        <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">SERVICES & CHARGES</h3>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left border">Description</th>
              <th className="py-2 px-4 text-right border">Amount (THB)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 px-4 border">Freight Cost</td>
              <td className="py-2 px-4 text-right border">{formatNumber(freightCost)} THB</td>
            </tr>
            {clearanceCost > 0 && (
              <tr className="border-b">
                <td className="py-2 px-4 border">Clearance Cost</td>
                <td className="py-2 px-4 text-right border">{formatNumber(clearanceCost)} THB</td>
              </tr>
            )}
            {data?.delivery_service_required && (
              <tr className="border-b">
                <td className="py-2 px-4 border">Delivery Service ({data?.delivery_vehicle_type || 'N/A'})</td>
                <td className="py-2 px-4 text-right border">{formatNumber(deliveryCost)} THB</td>
              </tr>
            )}

            {data?.additional_charges && data.additional_charges.length > 0 ? (
              data.additional_charges.map((charge: AdditionalCharge, index: number) => (
                <tr key={index} className="border-b">
                  <td className="py-2 px-4 border">Additional: {charge.description as string || 'Additional Charge'}</td>
                  <td className="py-2 px-4 text-right border">{formatNumber(charge.amount || 0)} THB</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-2 px-4 text-center italic text-gray-500 border">No additional charges</td>
              </tr>
            )}

            <tr className="bg-gray-100 font-bold">
              <td className="py-2 px-4 border">Total Cost</td>
              <td className="py-2 px-4 text-right border">{formatNumber(totalCost)} THB</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {data?.notes && (
        <div className="mb-8">
          <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">NOTES</h3>
          <div className="p-4 bg-gray-50 rounded-md text-sm">{data.notes}</div>
        </div>
      )}

      {/* Bank Account Information */}
      <div className="mb-8">
        <h3 className="font-semibold border-b border-gray-300 pb-1 mb-3">PAYMENT INFORMATION</h3>
        <div className="p-4 bg-gray-50 rounded-md text-sm space-y-1">
          <p><strong>Kindly transfer to the following account:</strong></p>
          <p><strong>Bank:</strong> KASIKORN BANK</p>
          <p><strong>Account Name:</strong> Mr. Shivek Sachdev</p>
          <p><strong>Account Number:</strong> 784-2-02905-2</p>
        </div>
      </div>

      <div className="flex flex-row justify-between mb-4">
        <div className="flex flex-col">
          <p className="font-semibold">Client</p>
          <p>{data?.company_name || "N/A"}</p>
          <p className="text-sm text-gray-600">{data?.customer_name || "N/A"}</p>
        </div>
        <div className="flex flex-col text-right">
          <p className="font-semibold">Quotation Date</p>
          <p>{getQuotationDate()}</p>
        </div>
      </div>
    </div>
  );
} 