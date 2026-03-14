"use client";

import React from 'react';
import { Opportunity, STAGE_LABELS, STAGE_COLORS } from '@/types/opportunity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash, CheckCircle, XCircle, FileText, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ListViewProps {
  opportunities: Opportunity[];
  onEdit?: (opportunity: Opportunity) => void;
  onDelete?: (id: string) => void;
  onWinCase?: (id: string) => void;
  onLoseCase?: (id: string) => void;
}

export function ListView({ opportunities, onEdit, onDelete, onWinCase, onLoseCase }: ListViewProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleViewQuotation = (quotationId: string) => {
    router.push(`/quotations/preview?id=${quotationId}`);
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden md:block rounded-md border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-center">Prob.</TableHead>
              <TableHead>Close Date</TableHead>
              <TableHead>Quotations</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No opportunities found
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opp) => (
                <TableRow
                  key={opp.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${opp.closureStatus === 'won'
                      ? 'bg-emerald-50/50'
                      : opp.closureStatus === 'lost'
                        ? 'bg-red-50/50'
                        : ''
                    }`}
                  onClick={() => router.push(`/opportunities/${opp.id}`)}
                >
                  {/* Status Badge */}
                  <TableCell>
                    {opp.closureStatus === 'won' && (
                      <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                        🏆 WON
                      </Badge>
                    )}
                    {opp.closureStatus === 'lost' && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
                        ❌ LOST
                      </Badge>
                    )}
                    {!opp.closureStatus && (
                      <span className="text-xs text-gray-400">Active</span>
                    )}
                  </TableCell>

                  {/* Company */}
                  <TableCell className="font-medium text-blue-600">
                    {opp.companyName}
                  </TableCell>

                  {/* Topic */}
                  <TableCell className="max-w-[200px]">
                    <span className="truncate block font-semibold text-gray-900" title={opp.topic}>
                      {opp.topic}
                    </span>
                  </TableCell>

                  {/* Destination */}
                  <TableCell className="text-sm">
                    {opp.destinationName || '-'}
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="text-right font-semibold">
                    {opp.amount.toLocaleString()} {opp.currency}
                  </TableCell>

                  {/* Stage */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase tracking-wider ${STAGE_COLORS[opp.stage]}`}
                    >
                      {STAGE_LABELS[opp.stage]}
                    </Badge>
                  </TableCell>

                  {/* Probability */}
                  <TableCell className="text-center">
                    <span className={`text-sm font-medium ${opp.probability >= 70 ? 'text-emerald-600' :
                        opp.probability >= 40 ? 'text-amber-600' :
                          'text-gray-500'
                      }`}>
                      {opp.probability}%
                    </span>
                  </TableCell>

                  {/* Close Date */}
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(opp.closeDate)}
                  </TableCell>

                  {/* Quotations */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {opp.quotationIds && opp.quotationIds.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-green-700 font-bold bg-green-50 hover:bg-green-100 border border-green-200">
                            <FileText className="mr-1 h-3 w-3" />
                            {opp.quotationIds.length} Quote{opp.quotationIds.length > 1 ? 's' : ''}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {opp.quotationIds.map((qId, index) => (
                            <DropdownMenuItem
                              key={qId}
                              onClick={() => handleViewQuotation(qId)}
                              className="cursor-pointer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Quotation {index + 1}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No quotes</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!opp.closureStatus && (
                          <>
                            <DropdownMenuItem
                              className="cursor-pointer text-green-600 focus:text-green-600"
                              onClick={() => {
                                if (confirm('Mark this opportunity as WON?')) {
                                  onWinCase?.(opp.id);
                                }
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Win Case
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 focus:text-red-600"
                              onClick={() => {
                                if (confirm('Mark this opportunity as LOST?')) {
                                  onLoseCase?.(opp.id);
                                }
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Lose Case
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => onEdit?.(opp)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-red-600 focus:text-red-600"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this opportunity?')) {
                              onDelete?.(opp.id);
                            }
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - Visible on Mobile */}
      <div className="md:hidden space-y-3">
        {opportunities.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-500">
            No opportunities found
          </div>
        ) : (
          opportunities.map((opp) => (
            <div
              key={opp.id}
              className={`p-4 rounded-xl border bg-white shadow-sm transition-all active:scale-[0.98] ${opp.closureStatus === 'won'
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : opp.closureStatus === 'lost'
                    ? 'border-red-200 bg-red-50/20'
                    : 'border-slate-200'
                }`}
              onClick={() => router.push(`/opportunities/${opp.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-blue-600 truncate max-w-[150px]">{opp.companyName}</span>
                  <h3 className="font-bold text-gray-900 line-clamp-2 mt-0.5">{opp.topic}</h3>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase px-2 py-0 border-2 ${STAGE_COLORS[opp.stage]}`}
                  >
                    {STAGE_LABELS[opp.stage]}
                  </Badge>
                  {opp.closureStatus && (
                    <Badge className={`${opp.closureStatus === 'won' ? 'bg-emerald-500' : 'bg-red-500'} text-white text-[9px] px-1.5 py-0`}>
                      {opp.closureStatus.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-1 border-t border-slate-100 pt-3">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-tight">Destination</span>
                  <span className="text-xs font-medium text-gray-700">{opp.destinationName || '-'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-tight">Amount</span>
                  <span className="text-sm font-black text-slate-800">{opp.amount.toLocaleString()} <span className="text-[10px] font-normal">{opp.currency}</span></span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-tight">Probability</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${opp.probability >= 70 ? 'bg-emerald-500' : opp.probability >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`}
                        style={{ width: `${opp.probability}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-600">{opp.probability}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-tight">Quotations</span>
                  <div className="flex justify-end mt-0.5">
                    {opp.quotationIds && opp.quotationIds.length > 0 ? (
                      <div className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-emerald-100">
                        {opp.quotationIds.length} QUOTES
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">No quotes</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Actions Link */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
                  Tap to view details <ExternalLink className="h-2.5 w-2.5" />
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-100">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(opp)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => onDelete?.(opp.id)}>
                        <Trash className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}



