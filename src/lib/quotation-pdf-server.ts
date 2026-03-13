import { jsPDF } from 'jspdf';
import { Quotation, Pallet, AdditionalCharge } from './db';

/**
 * Generates a PDF buffer for a quotation.
 * This runs on the server side (Next.js API).
 */
export async function generateQuotationPDF(data: Quotation): Promise<Buffer> {
  // Initialize PDF (A4, points)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currY = 50;

  // --- Helper Functions ---
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null) return "0.00";
    const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(parsedNum)) return "0.00";
    return parsedNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getQuotationDate = () => {
    if (data.created_at) {
      const date = new Date(data.created_at);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  };

  // --- Header ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', margin, currY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Ref: ${data.quotation_no || data.id || 'N/A'}`, margin, currY + 15);

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OMGEXP Cargo Portal', pageWidth - margin, currY, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const addressLines = [
    '10/12-13 Convent Road, Silom, Bangrak,',
    'Bangkok 10500'
  ];
  addressLines.forEach((line, i) => {
    doc.text(line, pageWidth - margin, currY + 15 + (i * 12), { align: 'right' });
  });

  currY += 60;

  // --- Client & Shipping Information ---
  doc.setDrawColor(200);
  doc.line(margin, currY, pageWidth - margin, currY);
  currY += 20;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT INFORMATION', margin, currY);
  doc.text('SHIPPING DETAILS', pageWidth / 2 + 20, currY);
  
  currY += 15;
  doc.setFont('helvetica', 'normal');
  
  // Client Info column
  const clientInfo = [
    ['Company:', data.company_name || 'N/A'],
    ['Customer:', data.customer_name || 'N/A'],
    ['Contact:', data.contact_person || 'N/A'],
    ['Contract No:', data.contract_no || 'N/A']
  ];
  
  clientInfo.forEach((info, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(info[0], margin, currY + (i * 15));
    doc.setFont('helvetica', 'normal');
    doc.text(info[1], margin + 70, currY + (i * 15));
  });

  // Shipping Details column
  const shippingDetails = [
    ['Quotation Date:', getQuotationDate()],
    ['Destination:', data.destination || 'N/A']
  ];
  
  shippingDetails.forEach((info, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(info[0], pageWidth / 2 + 20, currY + (i * 15));
    doc.setFont('helvetica', 'normal');
    doc.text(info[1], pageWidth / 2 + 110, currY + (i * 15));
  });

  currY += 70;

  // --- Pallet Information Table ---
  doc.setFont('helvetica', 'bold');
  doc.text('PALLET INFORMATION', margin, currY);
  currY += 10;

  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, currY, pageWidth - (margin * 2), 20, 'F');
  doc.setFontSize(9);
  doc.text('#', margin + 10, currY + 13);
  doc.text('Dimensions (L×W×H cm)', margin + 40, currY + 13);
  doc.text('Actual Weight (kg)', margin + 180, currY + 13);
  doc.text('Volume Weight (kg)', margin + 280, currY + 13);
  doc.text('Qty', margin + 380, currY + 13);
  
  currY += 20;
  doc.setFont('helvetica', 'normal');

  const pallets = data.pallets || [];
  let totalActual = 0;
  let totalVolume = 0;

  pallets.forEach((pallet: Pallet, i: number) => {
    const l = Number(pallet.length) || 0;
    const w = Number(pallet.width) || 0;
    const h = Number(pallet.height) || 0;
    const wt = Number(pallet.weight) || 0;
    const qty = Number(pallet.quantity) || 1;
    
    const volWt = (l * w * h * qty) / 6000;
    totalActual += (wt * qty);
    totalVolume += volWt;

    doc.text((i + 1).toString(), margin + 10, currY + 13);
    doc.text(`${l} × ${w} × ${h}`, margin + 40, currY + 13);
    doc.text(wt.toString(), margin + 180, currY + 13);
    doc.text(Math.round(volWt).toString(), margin + 280, currY + 13);
    doc.text(qty.toString(), margin + 380, currY + 13);
    
    currY += 20;
    
    // Check for page overflow
    if (currY > 750) {
      doc.addPage();
      currY = 50;
    }
  });

  // Table Footer
  doc.setFont('helvetica', 'bold');
  doc.line(margin, currY, pageWidth - margin, currY);
  currY += 15;
  doc.text('Total', margin + 40, currY);
  doc.text(`${formatNumber(totalActual)} kg`, margin + 180, currY);
  doc.text(`${formatNumber(Math.ceil(totalVolume))} kg`, margin + 280, currY);
  
  currY += 20;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, currY - 15, pageWidth - (margin * 2), 20, 'F');
  doc.text('Chargeable Weight', margin + 40, currY);
  doc.text(`${formatNumber(Math.ceil(data.chargeable_weight || Math.max(totalActual, Math.ceil(totalVolume))))} kg`, margin + 180, currY);

  currY += 40;

  // --- Services & Charges Table ---
  doc.text('SERVICES & CHARGES', margin, currY);
  currY += 10;
  
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, currY, pageWidth - (margin * 2), 20, 'F');
  doc.text('Description', margin + 10, currY + 13);
  doc.text('Amount (THB)', pageWidth - margin - 10, currY + 13, { align: 'right' });
  
  currY += 20;
  doc.setFont('helvetica', 'normal');

  const charges = [
    { label: 'Freight Cost', amount: data.total_freight_cost || 0 },
    ...(data.clearance_cost ? [{ label: 'Clearance Cost', amount: data.clearance_cost }] : []),
    ...(data.delivery_service_required ? [{ label: `Delivery Service (${data.delivery_vehicle_type})`, amount: data.delivery_cost || 0 }] : []),
    ...(data.additional_charges || []).map((ac: AdditionalCharge) => ({
      label: `Additional: ${ac.description || ac.name}`,
      amount: Number(ac.amount) || 0
    }))
  ];

  charges.forEach((charge) => {
    doc.text(charge.label, margin + 10, currY + 13);
    doc.text(formatNumber(charge.amount), pageWidth - margin - 10, currY + 13, { align: 'right' });
    currY += 20;
    doc.line(margin, currY, pageWidth - margin, currY);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, currY, pageWidth - (margin * 2), 20, 'F');
  doc.text('Total Cost', margin + 10, currY + 13);
  doc.text(`${formatNumber(data.total_cost)} THB`, pageWidth - margin - 10, currY + 13, { align: 'right' });

  currY += 50;

  // --- Notes ---
  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', margin, currY);
    currY += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - (margin * 2) - 20);
    doc.rect(margin, currY - 10, pageWidth - (margin * 2), (splitNotes.length * 10) + 15);
    doc.text(splitNotes, margin + 10, currY + 5);
    currY += (splitNotes.length * 10) + 30;
  }

  // --- Payment Info ---
  if (currY > 650) {
    doc.addPage();
    currY = 50;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT INFORMATION', margin, currY);
  currY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const paymentInfo = [
    'Kindly transfer to the following account:',
    'Bank: KASIKORN BANK',
    'Account Name: Mr. Shivek Sachdev',
    'Account Number: 784-2-02905-2'
  ];
  paymentInfo.forEach((line, i) => {
    doc.text(line, margin, currY + (i * 12));
  });

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, margin, footerY);
  doc.text('OMGEXP Cargo Portal - Shipping Simplified', pageWidth - margin, footerY, { align: 'right' });

  // Output as buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
