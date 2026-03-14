"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { KanbanBoard } from '@/components/opportunities/kanban-board';
import { ListView } from '@/components/opportunities/list-view';
import { Button } from '@/components/ui/button';
import { RefreshCw, PlusCircle, LayoutGrid, List } from 'lucide-react';
import { OpportunityDialog } from '@/components/opportunities/new-opportunity-dialog';
import { Opportunity, OpportunityStage } from '@/types/opportunity';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCompanies } from '@/lib/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trophy, XCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewMode = 'kanban' | 'list';

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);

    // Get current user for filtering
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    let query = supabase
      .from('opportunities')
      // Select opportunity fields AND linked quotations(id)
      .select('*, quotations(id), destination:destination_id(country, port), opportunity_products(product:products(id, name))');

    // Filter by owner_id if user is logged in
    if (userId) {
      query = query.eq('owner_id', userId);
    }

    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching opportunities:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(`Failed to fetch opportunities: ${error.message}`);
    } else {
      interface RawSupabaseOpportunity {
        id: string;
        topic: string;
        customer_name: string | null;
        company_id: string | null;
        amount: number;
        currency: string;
        stage: OpportunityStage;
        probability: number;
        created_at: string;
        updated_at: string;
        close_date: string;
        vehicle_type?: string;
        container_size?: string;
        product_details?: string | { description?: string };
        notes?: string;
        destination_id?: string;
        destination?: { country: string; port: string | null };
        product_id?: string | null;
        quotations?: { id: string }[];
        opportunity_products?: { product: { id: string; name: string } }[];
        closure_status?: 'won' | 'lost' | null;
        focus_color?: string | null;
        sort_order?: number | null;
      }

      // Map DB fields to Frontend types
      const mapped: Opportunity[] = (data as unknown as RawSupabaseOpportunity[]).map((item) => {
        // item.quotations will be an array of objects { id: ... } - get ALL quotation IDs
        const quotationIds = item.quotations && item.quotations.length > 0
          ? item.quotations.map(q => q.id)
          : [];

        // Extract destination name
        const dest = item.destination;
        const destinationName = dest ? `${dest.country}${dest.port ? ` (${dest.port})` : ''}` : undefined;

        return {
          id: item.id,
          topic: item.topic,
          customerName: item.customer_name || 'Unknown',
          companyName: item.customer_name || 'Unknown',
          companyId: item.company_id || undefined,
          amount: item.amount,
          currency: item.currency,
          stage: item.stage,
          probability: item.probability,
          closeDate: item.close_date,
          ownerName: 'Me',
          createdAt: item.created_at,
          updatedAt: item.updated_at,

          vehicleType: item.vehicle_type,
          containerSize: item.container_size,
          productDetails: typeof item.product_details === 'object' ? item.product_details?.description || '' : item.product_details || '',
          notes: item.notes,
          destinationId: item.destination_id,
          destinationName,
          productId: item.opportunity_products?.map(op => op.product.id) || [],
          productName: item.opportunity_products?.map(op => op.product.name) || [],

          quotationIds: quotationIds,
          closureStatus: item.closure_status || null,
          focusColor: item.focus_color || null,
          sortOrder: item.sort_order || null
        }
      });
      setOpportunities(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOpportunities();

    // Subscribe to realtime changes in quotations to update the board when a quotation is linked
    const channel = supabase
      .channel('realtime-quotations-opportunities')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotations' },
        (payload) => {
          console.log('Quotation change detected:', payload);
          fetchOpportunities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOpportunities]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | undefined>(undefined);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [showWon, setShowWon] = useState<boolean>(false);
  const [showLost, setShowLost] = useState<boolean>(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Auto-switch to list view on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('list');
      }
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch companies for filter
  useEffect(() => {
    const fetchCompaniesData = async () => {
      const companiesData = await getCompanies();
      setCompanies(companiesData || []);
    };
    fetchCompaniesData();
  }, []);

  const handleEditOpportunity = (opportunity: Opportunity) => {
    console.log('handleEditOpportunity called with:', opportunity);
    setEditingOpportunity(opportunity);
    setIsDialogOpen(true);
  };

  const handleDeleteOpportunity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting opportunity:', error);
        toast.error(`Failed to delete opportunity: ${error.message}`);
      } else {
        toast.success('Opportunity deleted');
        fetchOpportunities();
      }
    } catch (err) {
      console.error('Error in handleDelete:', err);
    }
  };

  const handleReorder = async (updatedSubset: Opportunity[]) => {
    // Build order map from the reordered subset
    const orderMap = new Map(updatedSubset.map((opp, index) => [opp.id, index]));

    // Update parent state: replace items AND reorder the array
    setOpportunities(prevOpportunities => {
      const updatedMap = new Map(updatedSubset.map(opp => [opp.id, opp]));

      // Update fields for items that were reordered
      const merged = prevOpportunities.map(opp => {
        const updated = updatedMap.get(opp.id);
        return updated ? updated : opp;
      });

      // Sort so items from the subset appear in their new order
      return merged.sort((a, b) => {
        const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
        const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
        if (aOrder !== Infinity && bOrder !== Infinity) return aOrder - bOrder;
        return 0;
      });
    });

    try {
      // Calculate sort_order based on the reordered subset
      const updates = updatedSubset.map((opp, index) => ({
        id: opp.id,
        sort_order: (index + 1) * 10
      }));

      // Supabase .upsert doesn't easily handle partial updates of specific columns across many rows
      // because it requires all NOT NULL fields to be present for the 'INSERT' part of the operation.
      // We'll use Promise.all for individual updates for now.
      const updatePromises = updates.map(u =>
        supabase
          .from('opportunities')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
      );

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error)?.error;

      if (firstError) throw firstError;

      console.log('Reorder saved successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save reorder:', message);
      toast.error('Failed to save arrangement: ' + message);
      // Optional: rollback fetchOpportunities();
    }
  };

  const handleSaveOpportunity = async (opportunityData: Partial<Opportunity>) => {
    try {
      console.log('handleSaveOpportunity received:', opportunityData);

      // Validate required fields
      if (!opportunityData.topic || opportunityData.topic.trim() === '') {
        throw new Error('Topic is required');
      }

      if (!opportunityData.customerName || opportunityData.customerName.trim() === '') {
        throw new Error('Customer name is required');
      }

      // Get current user ID for owner_id (optional - RLS disabled)
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        topic: opportunityData.topic.trim(),
        customer_name: opportunityData.customerName.trim(),
        company_id: opportunityData.companyId || null,
        amount: opportunityData.amount || 0,
        currency: opportunityData.currency || 'THB',
        stage: opportunityData.stage || 'new',
        probability: opportunityData.probability || 10,
        close_date: opportunityData.closeDate ? new Date(opportunityData.closeDate).toISOString().split('T')[0] : null,
        vehicle_type: opportunityData.vehicleType || null,
        container_size: opportunityData.containerSize || null,
        product_details: opportunityData.productDetails ? JSON.stringify(opportunityData.productDetails) : null,
        notes: opportunityData.notes || null,
        destination_id: opportunityData.destinationId || null,
        owner_id: user?.id || null, // Set owner if available
      };

      console.log('Payload to save:', payload);

      let oppId: string;

      if (editingOpportunity) {
        console.log('Updating existing opportunity:', editingOpportunity.id);
        const { error } = await supabase
          .from('opportunities')
          .update(payload)
          .eq('id', editingOpportunity.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        oppId = editingOpportunity.id;
        toast.success('Opportunity updated');
      } else {
        console.log('Creating new opportunity');
        const { data, error } = await supabase
          .from('opportunities')
          .insert([payload])
          .select('id')
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }

        oppId = data!.id;
        toast.success('Opportunity created');
      }

      // Update product links in junction table
      if (opportunityData.productId && opportunityData.productId.length > 0) {
        console.log('Updating product links for opportunity:', oppId);

        // Delete existing links
        const { error: deleteError } = await supabase
          .from('opportunity_products')
          .delete()
          .eq('opportunity_id', oppId);

        if (deleteError) {
          console.error('Error deleting product links:', deleteError);
          // Don't throw here, continue with insert
        }

        // Insert new links
        const productLinks = opportunityData.productId
          .filter(id => id && id !== 'none')
          .map(productId => ({
            opportunity_id: oppId,
            product_id: productId
          }));

        console.log('Product links to insert:', productLinks);

        if (productLinks.length > 0) {
          const { error: insertError } = await supabase
            .from('opportunity_products')
            .insert(productLinks);

          if (insertError) {
            console.error('Error inserting product links:', insertError);
            throw insertError;
          }
        }
      }

      fetchOpportunities();
      setIsDialogOpen(false);
      setEditingOpportunity(undefined);
    } catch (error: unknown) {
      console.error('Error saving opportunity:', error);

      let errorMessage = 'Failed to save opportunity';

      if (error && typeof error === 'object' && 'message' in error) {
        const err = error as { message?: string; details?: unknown; hint?: unknown; code?: string };
        console.error('Error details:', {
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code
        });

        // Provide more specific error messages
        if (err.code === '23503') {
          errorMessage = 'Invalid reference data. Please check company or destination selection.';
        } else if (err.code === '23505') {
          errorMessage = 'Duplicate data found.';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const handleStageChange = async (opportunityId: string, newStage: OpportunityStage) => {
    // Optimistically update the local state in the parent
    setOpportunities(prev => prev.map(opp =>
      opp.id === opportunityId
        ? { ...opp, stage: newStage, probability: getProbabilityForStage(newStage) }
        : opp
    ));

    const { error } = await supabase
      .from('opportunities')
      .update({
        stage: newStage,
        probability: getProbabilityForStage(newStage)
      })
      .eq('id', opportunityId);

    if (error) {
      toast.error('Failed to update stage');
      fetchOpportunities(); // Revert on error
    }
  };

  const handleWinCase = async (opportunityId: string) => {
    // Optimistic update
    setOpportunities(prev => prev.map(opp =>
      opp.id === opportunityId ? { ...opp, closureStatus: 'won' } : opp
    ));

    const { error } = await supabase
      .from('opportunities')
      .update({
        closure_status: 'won'
      })
      .eq('id', opportunityId);

    if (error) {
      toast.error('Failed to mark as won');
      fetchOpportunities(); // Revert
    } else {
      toast.success('Opportunity marked as WON! 🏆');
    }
  };

  const handleLoseCase = async (opportunityId: string) => {
    // Optimistic update
    setOpportunities(prev => prev.map(opp =>
      opp.id === opportunityId ? { ...opp, closureStatus: 'lost' } : opp
    ));

    const { error } = await supabase
      .from('opportunities')
      .update({
        closure_status: 'lost'
      })
      .eq('id', opportunityId);

    if (error) {
      toast.error('Failed to mark as lost');
      fetchOpportunities(); // Revert
    } else {
      toast.success('Opportunity marked as LOST');
    }
  };

  const getProbabilityForStage = (stage: OpportunityStage): number => {
    const map: Record<string, number> = {
      new: 10, under_review: 30, pending_booking: 50, booking_confirmed: 75,
      delivered: 100, cancelled: 0, on_hold: 40,
    };
    return map[stage] ?? 0;
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Opportunities</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your sales pipeline and track potential deals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchOpportunities} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <OpportunityDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingOpportunity(undefined);
            }}
            trigger={
              <Button size="sm" className="md:size-default">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span className="hidden xs:inline">New Opportunity</span>
                <span className="xs:hidden">New</span>
              </Button>
            }
            initialData={editingOpportunity}
            mode={editingOpportunity ? 'edit' : 'create'}
            onSubmit={handleSaveOpportunity}
          />
        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col gap-4 bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          {/* View Toggle - Hidden on very small screens, though we could just keep it */}
          <div className="hidden sm:block">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="grid w-[180px] grid-cols-2 h-9 p-1">
                <TabsTrigger value="kanban" className="text-xs flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="list" className="text-xs flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Company Filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:border-l sm:pl-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Won/Lost Filters */}
          <div className="flex items-center gap-4 border-t pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4 w-full sm:w-auto">
            <div className="flex items-center space-x-2 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <Checkbox
                id="show-won"
                checked={showWon}
                onCheckedChange={(checked) => setShowWon(checked as boolean)}
              />
              <Label
                htmlFor="show-won"
                className="text-xs font-bold flex items-center gap-1 cursor-pointer text-emerald-700"
              >
                <Trophy className="h-3 w-3" />
                WON ({opportunities.filter(o => o.closureStatus === 'won').length})
              </Label>
            </div>

            <div className="flex items-center space-x-2 bg-red-50/50 px-3 py-1.5 rounded-lg border border-red-100">
              <Checkbox
                id="show-lost"
                checked={showLost}
                onCheckedChange={(checked) => setShowLost(checked as boolean)}
              />
              <Label
                htmlFor="show-lost"
                className="text-xs font-bold flex items-center gap-1 cursor-pointer text-red-600"
              >
                <XCircle className="h-3 w-3" />
                LOST ({opportunities.filter(o => o.closureStatus === 'lost').length})
              </Label>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {/* Filter opportunities based on selected filters */}
          {(() => {
            const filteredOpportunities = opportunities.filter(opp => {
              // Filter by company
              if (selectedCompany !== 'all' && opp.companyId !== selectedCompany) {
                return false;
              }
              // Filter out Won cases unless showWon is checked
              if (opp.closureStatus === 'won' && !showWon) {
                return false;
              }
              // Filter out Lost cases unless showLost is checked
              if (opp.closureStatus === 'lost' && !showLost) {
                return false;
              }
              return true;
            });

            return viewMode === 'kanban' ? (
              <div className="flex-1 overflow-hidden rounded-md border bg-white p-4 shadow-sm h-[calc(100vh-200px)]">
                <KanbanBoard
                  onStageChange={handleStageChange}
                  onEditOpportunity={handleEditOpportunity}
                  onDeleteOpportunity={handleDeleteOpportunity}
                  onWinCase={handleWinCase}
                  onLoseCase={handleLoseCase}
                  onRefresh={fetchOpportunities}
                  onReorder={handleReorder}
                  initialOpportunities={filteredOpportunities}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-auto h-[calc(100vh-200px)]">
                <ListView
                  opportunities={filteredOpportunities}
                  onEdit={handleEditOpportunity}
                  onDelete={handleDeleteOpportunity}
                  onWinCase={handleWinCase}
                  onLoseCase={handleLoseCase}
                />
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
