"use client";

import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Opportunity, STAGE_COLORS } from '@/types/opportunity';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, ExternalLink, Loader2, MoreHorizontal, Edit, Trash, Plus, CheckCircle, XCircle, FileText, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface KanbanCardProps {
  opportunity: Opportunity;
  onEdit?: (opportunity: Opportunity) => void;
  onDelete?: (id: string) => void;
  onWinCase?: (id: string) => void;
  onLoseCase?: (id: string) => void;
  onRefresh?: () => void;
}

const FOCUS_COLORS = [
  { label: 'None', value: null, class: 'bg-transparent' },
  { label: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
  { label: 'Red', value: '#ef4444', class: 'bg-red-500' },
  { label: 'Green', value: '#10b981', class: 'bg-emerald-500' },
  { label: 'Yellow', value: '#f59e0b', class: 'bg-amber-500' },
  { label: 'Purple', value: '#8b5cf6', class: 'bg-violet-500' },
  { label: 'Orange', value: '#f97316', class: 'bg-orange-500' },
];

export function KanbanCard({ opportunity, onEdit, onDelete, onWinCase, onLoseCase, onRefresh }: KanbanCardProps) {
  // console.log(`Card ${opportunity.id}: onEdit is`, !!onEdit);
  const router = useRouter();
  const [creating] = useState(false);
  const [isUpdatingColor, setIsUpdatingColor] = useState(false);
  const [displayColor, setDisplayColor] = useState(opportunity.focusColor);

  // Sync if prop changes (e.g. from elsewhere or after refresh)
  useEffect(() => {
    setDisplayColor(opportunity.focusColor);
  }, [opportunity.focusColor]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: opportunity.id,
    data: {
      type: 'Opportunity',
      opportunity,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCreateQuotation = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag start

    // Calculate values to pass
    const params = new URLSearchParams();
    if (opportunity.id) params.set('opportunityId', opportunity.id);
    if (opportunity.productId && opportunity.productId.length > 0) params.set('productId', opportunity.productId.join(','));
    if (opportunity.companyId) params.set('companyId', opportunity.companyId);
    if (opportunity.companyName) params.set('customerName', opportunity.companyName);
    if (opportunity.destinationId) params.set('destinationId', opportunity.destinationId); // Pass destination
    // Map optional fields if they align with target form
    // Target form has 'deliveryVehicleType', 'notes'
    if (opportunity.vehicleType) params.set('deliveryVehicleType', opportunity.vehicleType);
    if (opportunity.notes) params.set('notes', opportunity.notes);

    // Navigate to existing creation page
    router.push(`/quotations/new?${params.toString()}`);
  };

  const quotationCount = opportunity.quotationIds?.length || 0;

  const handleUpdateColor = async (color: string | null) => {
    // Optimistic update
    setDisplayColor(color);

    setIsUpdatingColor(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ focus_color: color })
        .eq('id', opportunity.id);

      if (error) throw error;

      toast.success('Highlight color updated');
      // We still call onRefresh to keep parent in sync, 
      // but displayColor keeps it looking instant.
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating color:', err);
      // Rollback on error
      setDisplayColor(opportunity.focusColor);
      toast.error('Failed to update color');
    } finally {
      setIsUpdatingColor(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/opportunities/${opportunity.id}`)}
      className="cursor-pointer active:cursor-grabbing hover:opacity-90 transition-opacity"
    >
      <Card
        data-kanban-card
        className={`premium-shadow-hover transition-all duration-300 ${opportunity.closureStatus === 'won'
          ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/30'
          : opportunity.closureStatus === 'lost'
            ? 'ring-2 ring-red-400 border-red-300 bg-red-50/30'
            : 'border-none ring-1 ring-slate-100/50'
          } relative overflow-hidden pt-1.5`}>
        {/* Color Highlight Bar - Now at the Top and thicker */}
        {displayColor && (
          <div
            className="absolute left-0 top-0 right-0 h-1.5 z-10 opacity-90 shadow-sm"
            style={{ backgroundColor: displayColor }}
          />
        )}
        <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`font-semibold px-2 py-0.5 text-xs rounded-full ${STAGE_COLORS[opportunity.stage]}`}>
              {opportunity.probability}%
            </Badge>
            {/* Won/Lost Badge */}
            {opportunity.closureStatus === 'won' && (
              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-5 font-bold">
                🏆 WON
              </Badge>
            )}
            {opportunity.closureStatus === 'lost' && (
              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5 font-bold">
                ❌ LOST
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 pr-0.5">
            <div className="p-0.5 text-gray-300 cursor-grab opacity-40 hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer text-green-600 focus:text-green-600"
                  onSelect={() => {
                    if (confirm('Mark this opportunity as WON?')) {
                      if (onWinCase) onWinCase(opportunity.id);
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Win Case
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onSelect={() => {
                    if (confirm('Mark this opportunity as LOST?')) {
                      if (onLoseCase) onLoseCase(opportunity.id);
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Lose Case
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => {
                    if (onEdit) onEdit(opportunity);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                  onSelect={() => {
                    if (confirm('Are you sure you want to delete this opportunity?')) {
                      if (onDelete) onDelete(opportunity.id);
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>

                {/* Focus Color Submenu */}
                <div className="border-t my-1"></div>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Focus Color
                </div>
                <div className="flex flex-wrap gap-1 px-2 pb-2 mr-2">
                  {FOCUS_COLORS.map((c) => (
                    <button
                      key={c.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateColor(c.value);
                      }}
                      className={`h-5 w-5 rounded-full border border-gray-200 transition-transform hover:scale-110 flex items-center justify-center ${c.class}`}
                      title={c.label}
                      disabled={isUpdatingColor}
                    >
                      {displayColor === c.value && (
                        <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          {/* Company Name - Main Title */}
          <p className="text-sm font-bold text-blue-600 truncate">{opportunity.companyName}</p>

          {/* Topic as subtitle */}
          <h4 className="text-xs text-slate-600 line-clamp-1 mb-1">{opportunity.topic}</h4>

          {/* Amount */}
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-bold text-gray-900">
              {opportunity.amount.toLocaleString()} {opportunity.currency}
            </span>
          </div>

          {/* Compact Details - Only show key info */}
          <div className="space-y-0.5 mb-2 text-xs">
            {opportunity.destinationName && (
              <div className="text-blue-700 font-medium truncate">
                📍 {opportunity.destinationName}
              </div>
            )}
            {opportunity.productDetails && (
              <div className="text-gray-600 line-clamp-1">
                📦 {opportunity.productDetails}
              </div>
            )}
          </div>

          {/* Product Tags - Compact */}
          {opportunity.productName && opportunity.productName.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {opportunity.productName.slice(0, 2).map((name, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded border border-emerald-100">
                  {name}
                </span>
              ))}
              {opportunity.productName.length > 2 && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                  +{opportunity.productName.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Action Buttons - Support Multiple Quotations */}
          <div className="flex gap-1">
            {quotationCount > 0 ? (
              <>
                {/* View Quotations Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="mr-1 h-3 w-3" />
                      {quotationCount} Quotation{quotationCount > 1 ? 's' : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {opportunity.quotationIds?.map((qId, index) => (
                      <DropdownMenuItem
                        key={qId}
                        className="cursor-pointer text-xs"
                        onSelect={() => router.push(`/quotations/preview?id=${qId}`)}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        View Quotation #{index + 1}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Add New Quotation Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                  onClick={handleCreateQuotation}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={creating}
                  title="Add New Quotation"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 border-none shadow-sm"
                onClick={handleCreateQuotation}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3 w-3" />
                )}
                {creating ? 'Processing...' : 'Generate Quotation'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
