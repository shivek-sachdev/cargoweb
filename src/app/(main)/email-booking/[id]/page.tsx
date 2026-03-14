'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Copy, Mail, Send, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getQuotationById, Quotation } from '@/lib/db';
import { generateBookingEmailFromQuotation, formatBookingEmail, generateEmailSubject, EmailBookingData } from '@/lib/email-templates';


export default function EmailBookingPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailData, setEmailData] = useState<EmailBookingData>({});
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');

  useEffect(() => {
    const loadQuotation = async () => {
      try {
        setLoading(true);
        const quotationData = await getQuotationById(quotationId);

        if (quotationData) {
          setQuotation(quotationData);

          // Generate initial email data from quotation
          const initialEmailData = generateBookingEmailFromQuotation(quotationData);
          setEmailData(initialEmailData);

          // Generate email content and subject
          const content = formatBookingEmail(initialEmailData);
          const subject = generateEmailSubject(initialEmailData);

          setEmailContent(content);
          setEmailSubject(subject);
        } else {
          toast.error('Quotation not found');
          router.push('/quotations');
        }
      } catch (error) {
        console.error('Error loading quotation:', error);
        toast.error('Error loading quotation');
      } finally {
        setLoading(false);
      }
    };

    if (quotationId) {
      loadQuotation();
    }
  }, [quotationId, router]);

  const handleInputChange = (field: keyof EmailBookingData, value: string | number) => {
    const updatedData = {
      ...emailData,
      [field]: value
    };

    setEmailData(updatedData);

    // Regenerate email content
    const content = formatBookingEmail(updatedData);
    const subject = generateEmailSubject(updatedData);

    setEmailContent(content);
    setEmailSubject(subject);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailContent);
    toast.success('Email content copied to clipboard!');
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(emailSubject);
    toast.success('Email subject copied to clipboard!');
  };

  const handleOpenEmailClient = () => {
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailContent);
    const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;

    window.open(mailtoUrl, '_blank');
  };

  const handleExportPDF = async () => {
    if (!quotation) return;

    // Create a simple HTML version for printing
    const htmlContent = `
      <html>
        <head>
          <title>Email Booking - ${emailData.recipientName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Email Booking</h1>
            <p><strong>Subject:</strong> ${generateEmailSubject(emailData)}</p>
          </div>
          <div class="content">${emailContent}</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast.success('Print dialog opened!');
    } else {
      toast.error('Unable to open print window');
    }
  };

  const handlePrintEmail = () => {
    if (!quotation) return;

    // Use the same HTML generation as handleExportPDF
    const htmlContent = `
      <html>
        <head>
          <title>Email Booking - ${emailData.recipientName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Email Booking</h1>
            <p><strong>Subject:</strong> ${generateEmailSubject(emailData)}</p>
          </div>
          <div class="content">${emailContent}</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-pulse">Loading quotation...</div>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Quotation not found</h1>
          <Button onClick={() => router.push('/quotations')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/quotations')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Email Booking</h1>
            <p className="text-muted-foreground">Quotation: {quotation.quotation_no || quotation.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Email Details
            </CardTitle>
            <CardDescription>
              Fill in the details for your booking email. Fields marked with data from quotation will be pre-filled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient Information */}
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name</Label>
              <Input
                id="recipientName"
                value={emailData.recipientName || ''}
                onChange={(e) => handleInputChange('recipientName', e.target.value)}
                placeholder="e.g., Montri"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senderName">Your Name</Label>
              <Input
                id="senderName"
                value="Weeraphat"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Sender name is always &quot;Weeraphat&quot;</p>
            </div>

            {/* Shipment Information */}
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Input
                id="product"
                value="Dried Cannabis Flower"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Product is always &quot;Dried Cannabis Flower&quot;</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={emailData.destination || ''}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                placeholder="e.g., Munich, Germany"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="netWeight">Net Weight (KG) - Actual Weight</Label>
              <Input
                id="netWeight"
                type="number"
                value={emailData.netWeight || ''}
                onChange={(e) => handleInputChange('netWeight', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 1000"
              />
              <p className="text-xs text-muted-foreground">This is the actual weight, not volume weight</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="airline">Airline</Label>
              <Input
                id="airline"
                value={emailData.airline || ''}
                onChange={(e) => handleInputChange('airline', e.target.value)}
                placeholder="e.g., Thai Airways"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredShipmentDate">Preferred Shipment Date</Label>
              <Input
                id="preferredShipmentDate"
                value={emailData.preferredShipmentDate || ''}
                onChange={(e) => handleInputChange('preferredShipmentDate', e.target.value)}
                placeholder="e.g., 2024-02-15"
              />
            </div>

            {/* Additional Details */}
            <div className="space-y-2">
              <Label htmlFor="consignee">Consignee</Label>
              <Input
                id="consignee"
                value={emailData.consignee || ''}
                onChange={(e) => handleInputChange('consignee', e.target.value)}
                placeholder="e.g., Czech Work s.r.o."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routing">Routing</Label>
              <Input
                id="routing"
                value={emailData.routing || ''}
                onChange={(e) => handleInputChange('routing', e.target.value)}
                placeholder="e.g., BKK-MUC"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>
              Preview of the generated email content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Subject Line */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subject Line</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySubject}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{emailSubject}</p>
              </div>
            </div>

            {/* Email Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Content</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={emailContent}
                readOnly
                className="min-h-[400px] font-mono text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Button
                  onClick={handleOpenEmailClient}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Open in Email Client
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyEmail}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleExportPDF}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintEmail}
                  className="flex-1"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Quotation Summary</CardTitle>
          <CardDescription>
            Reference information from the original quotation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Quotation ID</Label>
              <p className="font-medium">{quotation.quotation_no || quotation.id.slice(0, 8)}</p>
            </div>
            <div>
              <Label>Company</Label>
              <p className="font-medium">{quotation.company_name || 'N/A'}</p>
            </div>
            <div>
              <Label>Total Cost</Label>
              <p className="font-medium">
                {new Intl.NumberFormat('th-TH', {
                  style: 'currency',
                  currency: 'THB'
                }).format(quotation.total_cost)}
              </p>
            </div>
            <div>
              <Label>Status</Label>
              <p className="font-medium capitalize">{quotation.status}</p>
            </div>
            <div>
              <Label>Created Date</Label>
              <p className="font-medium">
                {new Date(quotation.created_at).toLocaleDateString('th-TH')}
              </p>
            </div>
            <div>
              <Label>Chargeable Weight</Label>
              <p className="font-medium">{quotation.chargeable_weight || 'N/A'} KG</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
