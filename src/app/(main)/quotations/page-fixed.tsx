'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Plus, FileText, Trash, Search, Share2, FileArchive, CheckCircle, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getQuotations, deleteQuotation as dbDeleteQuotation, updateQuotation, Quotation } from '@/lib/db';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ShippingCalculatorPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');
  const [completedDate, setCompletedDate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // First useEffect - only for auth checking
  useEffect(() => {
    console.log("ShippingCalculator: Checking authentication");
    
    // Simple check for user data in localStorage
    function checkLocalAuth() {
      try {
        // First check our local user object
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user && user.isAuthenticated) {
            console.log("ShippingCalculator: Local auth found for", user.email);
            setAuthChecked(true);
            return true;
          }
        }
        
        // Also check our auth_session
        const authSession = localStorage.getItem('auth_session');
        if (authSession) {
          const session = JSON.parse(authSession);
          if (session && session.email) {
            console.log("ShippingCalculator: Auth session found for", session.email);
            setAuthChecked(true);
            return true;
          }
        }
        
        return false;
      } catch (err) {
        console.error("ShippingCalculator: Error checking local auth", err);
        return false;
      }
    }
    
    // Check Supabase session as a fallback
    async function checkSupabaseAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session) {
          console.log("ShippingCalculator: Supabase session found for", data.session.user.email);
          
          // Save to localStorage for future checks
          localStorage.setItem('user', JSON.stringify({
            email: data.session.user.email,
            id: data.session.user.id,
            isAuthenticated: true
          }));
          
          setAuthChecked(true);
          return true;
        }
        return false;
      } catch (err) {
        console.error("ShippingCalculator: Error checking Supabase auth", err);
        return false;
      }
    }
    
    // First try local auth (faster)
    if (checkLocalAuth()) {
      console.log("ShippingCalculator: User is authenticated via local storage");
      return;
    }
    
    // If local auth fails, try Supabase
    checkSupabaseAuth().then(isAuthenticated => {
      if (!isAuthenticated) {
        console.log("ShippingCalculator: No authentication found, redirecting to login");
        window.location.href = '/login';
      }
    });
  }, []);

  // Load quotations from Supabase after auth is confirmed
  useEffect(() => {
    // Only load data after authentication is confirmed
    if (!authChecked) return;
    
    console.log("ShippingCalculator: Loading quotation data from Supabase");
    
    // Get user data from localStorage
    let userId = '';
    try {
      const userString = localStorage.getItem('user');
      if (userString) {
        const userData = JSON.parse(userString);
        userId = userData.id;
      }
    } catch (error) {
      console.error('Error getting user information:', error);
    }
    
    if (!userId) {
      console.error('User ID not found, cannot load quotations');
      setLoading(false);
      return;
    }
    
    // Load from Supabase
    async function loadQuotationsFromDB() {
      try {
        const quotationData = await getQuotations(userId);
        if (quotationData) {
          setQuotations(quotationData);
        } else {
          // Fallback to localStorage if database fetch fails
          const savedQuotations = localStorage.getItem('quotations');
          if (savedQuotations) {
            const parsedQuotations = JSON.parse(savedQuotations);
            setQuotations(parsedQuotations);
          } else {
            setQuotations([]);
          }
        }
      } catch {
        console.error('Error loading quotations from database:');
        setQuotations([]); 
      } finally {
        setLoading(false);
      }
    }
    
    loadQuotationsFromDB();
  }, [authChecked]);

  // Format number as currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return dateString; // Return original string if parsing fails
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'draft':
        return 'warning';
      case 'sent':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'docs_uploaded':
        return 'purple'; // Use the new purple variant
      case 'completed':
        return 'success';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'draft':
        return 'Draft';
      case 'sent':
        return 'Submitted';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'docs_uploaded':
        return 'Documents Uploaded';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    // ขอการยืนยันก่อนลบ
    const isConfirmed = window.confirm(`คุณต้องการลบใบเสนอราคา ${id} ใช่หรือไม่?`);
    
    if (!isConfirmed) {
      return; // ยกเลิกการลบถ้าไม่ยืนยัน
    }
    
    // Remove quotation from UI immediately for responsive feel
    setQuotations(quotations.filter(q => q.id !== id));
    
    // Delete from Supabase
    try {
      const success = await dbDeleteQuotation(id);
      
      if (!success) {
        console.error('Failed to delete quotation from database');
        // Restore UI if database delete fails
        const savedQuotations = localStorage.getItem('quotations');
        if (savedQuotations) {
          const parsedQuotations = JSON.parse(savedQuotations);
          setQuotations(parsedQuotations);
        }
      } else {
        console.log('Quotation deleted successfully from database');
        
        // Also remove from localStorage for sync
        try {
          const savedQuotations = localStorage.getItem('quotations');
          if (savedQuotations) {
            const parsedQuotations = JSON.parse(savedQuotations);
            const updatedQuotations = parsedQuotations.filter((q: { id: string }) => q.id !== id);
            localStorage.setItem('quotations', JSON.stringify(updatedQuotations));
          }
        } catch (error) {
          console.error('Error removing quotation from localStorage:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
    }
  };

  const handleViewQuotation = async (id: string) => {
    // Find quotation in our list
    const quotation = quotations.find(q => q.id === id);
    if (quotation) {
      // คำนวณ freight cost ใหม่ตามน้ำหนักที่มี
      const chargeableWeight = quotation.chargeable_weight || 0;
      
      // ถ้ามี total_cost แต่ไม่มี freight cost ให้ประมาณค่า
      // โดยอ้างอิงจากค่า total_cost หักลบค่าอื่นๆ
      let totalFreightCost = quotation.total_freight_cost || 0;
      
      if (totalFreightCost === 0 && chargeableWeight > 0) {
        // ประมาณฟรีทคอสต์จาก total_cost
        // ลบค่า clearance_cost และ delivery_cost (ถ้ามี)
        const clearanceCost = quotation.clearance_cost || 0;
        const deliveryCost = quotation.delivery_service_required ? 
          (quotation.delivery_vehicle_type === '4wheel' ? 3500 : 6500) : 0;
        
        // คำนวณผลรวมของ additional charges
        let additionalChargesTotal = 0;
        if (Array.isArray(quotation.additional_charges)) {
          additionalChargesTotal = quotation.additional_charges.reduce((sum, charge) => {
            const amount = typeof charge.amount === 'number' ? charge.amount : parseFloat(charge.amount) || 0;
            return sum + amount;
          }, 0);
        }
        
        // ประมาณฟรีทคอสต์
        totalFreightCost = quotation.total_cost - clearanceCost - deliveryCost - additionalChargesTotal;
        
        // กรณีคำนวณแล้วติดลบ ให้กำหนดเป็น 0
        totalFreightCost = Math.max(0, totalFreightCost);
      }
      
      // เพิ่มค่า freight cost และข้อมูลอื่นๆ ที่จำเป็น
      const enhancedQuotation = {
        ...quotation,
        totalFreightCost: totalFreightCost,
        totalVolumeWeight: quotation.total_volume_weight || 0,
        totalActualWeight: quotation.total_actual_weight || 0,
        chargeableWeight: chargeableWeight,
        clearanceCost: quotation.clearance_cost || 0,
        deliveryCost: quotation.delivery_service_required ? 
          (quotation.delivery_vehicle_type === '4wheel' ? 3500 : 6500) : 0
      };
      
      // Set the quotation data in sessionStorage for the preview page
      sessionStorage.setItem('quotationData', JSON.stringify(enhancedQuotation));
      router.push(`/quotations/preview?id=${id}`);
    }
  };

  // Handle complete quotation
  const handleOpenCompleteDialog = (id: string) => {
    setSelectedQuotationId(id);
    setCompletedDate(new Date());
    setIsCompleteDialogOpen(true);
  };

  const handleCompleteQuotation = async () => {
    if (!selectedQuotationId || !completedDate) return;

    setIsUpdating(true);
    try {
      // Update quotation status in the database
      const result = await updateQuotation(selectedQuotationId, {
        status: 'completed',
        completed_at: completedDate.toISOString()
      });

      if (result) {
        // Update local state
        setQuotations(prev => 
          prev.map(q => 
            q.id === selectedQuotationId 
              ? { ...q, status: 'completed', completed_at: completedDate.toISOString() } 
              : q
          )
        );
        
        toast.success('Quotation Completed', {
          description: `Quotation has been marked as completed.`
        });
      } else {
        toast.error('Failed to complete quotation');
      }
    } catch (error) {
      console.error('Error completing quotation:', error);
      toast.error('An error occurred');
    } finally {
      setIsUpdating(false);
      setIsCompleteDialogOpen(false);
    }
  };

  // Filter quotations based on search term (use fields available in the data)
  const filteredQuotations = quotations.filter(quotation => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      (quotation.id?.toLowerCase().includes(searchTermLower)) ||
      (quotation.company_name?.toLowerCase().includes(searchTermLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Quotations</h1>
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="h-4 w-4 mr-2" />
            New Calculation
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Quotations</CardTitle>
          <CardDescription>View and manage your recent shipping quotations</CardDescription>
          {/* Add Search Input Here */}
          <div className="relative mt-4">
             {/* Add Search Icon back */}
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> 
             <Input 
                type="search"
                placeholder="Search by ID or Company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full md:w-1/3"
              />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-pulse">Loading quotations...</div>
            </div>
          ) : quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium">No quotations yet</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Create your first shipping calculation to generate a quotation.
              </p>
              <Button asChild>
                <Link href="/quotations/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Calculation
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell>{formatDate(quotation.created_at)}</TableCell>
                      <TableCell>{quotation.id}</TableCell>
                      <TableCell>{quotation.company_name}</TableCell>
                      <TableCell>{quotation.destination}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(quotation.status)}>
                          {getStatusText(quotation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(quotation.total_cost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => handleViewQuotation(quotation.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const url = `${window.location.origin}/documents-upload/${quotation.id}?company=${encodeURIComponent(quotation.company_name || '')}&destination=${encodeURIComponent(quotation.destination || '')}`;
                              navigator.clipboard.writeText(url);
                              toast.success('Link Copied', {
                                description: 'Document upload link copied to clipboard!'
                              });
                            }}
                            title="Share document upload link"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                            title="View document submissions"
                          >
                            <Link href={`/document-submissions?quotation=${quotation.id}`}>
                              <FileArchive className="h-4 w-4" />
                            </Link>
                          </Button>

                          {quotation.status !== 'completed' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenCompleteDialog(quotation.id)}
                              title="Mark as completed"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteQuotation(quotation.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Confirmation Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Quotation as Completed</DialogTitle>
            <DialogDescription>
              This will mark the quotation as completed. The completion date will be set to today.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span>Completion Date: {completedDate.toLocaleDateString()}</span>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteQuotation} 
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdating ? 'Processing...' : 'Complete Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 