"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Opportunity, OpportunityStage, PIPELINE_STAGES } from '@/types/opportunity';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';

// Custom hook for drag-to-scroll like Trello
function useDragToScroll() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Check if clicked on a card or interactive element
        const target = e.target as HTMLElement;
        const isCard = target.closest('[data-kanban-card]');
        const isButton = target.closest('button');
        const isLink = target.closest('a');
        const isInput = target.closest('input');

        // Only activate drag-to-scroll when NOT clicking on cards or buttons
        if (!isCard && !isButton && !isLink && !isInput) {
            setIsDragging(true);
            setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
            setScrollLeft(containerRef.current?.scrollLeft || 0);
            e.preventDefault();
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - (containerRef.current?.offsetLeft || 0);
        const walk = (x - startX) * 2; // Scroll speed multiplier
        if (containerRef.current) {
            containerRef.current.scrollLeft = scrollLeft - walk;
        }
    }, [isDragging, startX, scrollLeft]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
        }
    }, [isDragging]);

    return {
        containerRef,
        isDragging,
        handlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseLeave,
        }
    };
}

const STAGES: OpportunityStage[] = PIPELINE_STAGES;

interface KanbanBoardProps {
    initialOpportunities: Opportunity[];
    onStageChange?: (opportunityId: string, newStage: OpportunityStage) => void;
    onEditOpportunity?: (opportunity: Opportunity) => void;
    onDeleteOpportunity?: (id: string) => void;
    onWinCase?: (id: string) => void;
    onLoseCase?: (id: string) => void;
    onRefresh?: () => void;
    onReorder?: (updatedOpportunities: Opportunity[]) => void;
}

export function KanbanBoard({ initialOpportunities, onStageChange, onEditOpportunity, onDeleteOpportunity, onWinCase, onLoseCase, onRefresh, onReorder }: KanbanBoardProps) {
    // Sync state with props
    const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);

    // Watch for prop changes (e.g. new item added from parent)
    useEffect(() => {
        setOpportunities(initialOpportunities);
    }, [initialOpportunities]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [startStage, setStartStage] = useState<OpportunityStage | null>(null);

    // Drag to scroll like Trello
    const { containerRef, isDragging, handlers } = useDragToScroll();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findContainer = (id: string, items: Opportunity[]) => {
        if (STAGES.includes(id as OpportunityStage)) {
            return id as OpportunityStage;
        }
        const item = items.find((o) => o.id === id);
        return item?.stage;
    };

    function handleDragStart(event: DragStartEvent) {
        const id = event.active.id as string;
        setActiveId(id);
        const stage = findContainer(id, opportunities);
        if (stage && STAGES.includes(stage)) {
            setStartStage(stage);
        }
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        setOpportunities((prev) => {
            const activeId = active.id as string;
            const overIdStr = overId as string;

            const activeContainer = findContainer(activeId, prev);
            const overContainer = findContainer(overIdStr, prev);

            if (!activeContainer || !overContainer || activeContainer === overContainer) {
                return prev;
            }

            const activeIndex = prev.findIndex((o) => o.id === activeId);
            const overIndex = prev.findIndex((o) => o.id === overIdStr);

            let newIndex;
            if (overIndex !== -1) {
                newIndex = overIndex;
            } else {
                // If dropped on empty container, find first/last index for that container
                const containerItems = prev.filter(o => o.stage === overContainer);
                if (containerItems.length > 0) {
                    newIndex = prev.findIndex(o => o.id === containerItems[containerItems.length - 1].id) + 1;
                } else {
                    newIndex = prev.length;
                }
            }

            const newItems = [...prev];
            const newStage = overContainer as OpportunityStage;
            newItems[activeIndex] = {
                ...newItems[activeIndex],
                stage: newStage,
                probability: getProbabilityForStage(newStage)
            };

            return arrayMove(newItems, activeIndex, newIndex);
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId) {
            setActiveId(null);
            setStartStage(null);
            return;
        }

        const activeId = active.id as string;
        const overIdStr = overId as string;

        setOpportunities((prev) => {
            const activeIndex = prev.findIndex((o) => o.id === activeId);
            let overIndex = prev.findIndex((o) => o.id === overIdStr);

            const activeContainer = findContainer(activeId, prev);
            const overContainer = findContainer(overIdStr, prev);

            if (!activeContainer || !overContainer) return prev;

            // Reordering within the same column or final drop after DragOver
            if (activeContainer === overContainer) {
                if (overIndex === -1) {
                    // Try to move to the very top of the column if dropped on the container/header
                    overIndex = prev.findIndex(o => o.stage === overContainer);
                }

                if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                    const newItems = arrayMove(prev, activeIndex, overIndex);
                    // Defer callbacks to avoid state updates during render
                    queueMicrotask(() => {
                        onReorder?.(newItems);
                    });
                    return newItems;
                }
            }

            // If we've reached here, either no reorder was needed or it was a cross-column move
            // Check if stage change needs reporting
            if (startStage && activeContainer && startStage !== activeContainer) {
                onStageChange?.(activeId, activeContainer as OpportunityStage);
                queueMicrotask(() => {
                    onReorder?.(prev);
                });
            } else if (activeIndex !== -1) {
                // Occasion when same column move but DragEnd didn't change indices (already handled by DragOver)
                queueMicrotask(() => {
                    onReorder?.(prev);
                });
            }

            return prev;
        });

        setActiveId(null);
        setStartStage(null);
    }

    const getProbabilityForStage = (stage: OpportunityStage): number => {
        const map: Record<string, number> = {
            new: 10, under_review: 30, pending_booking: 50, booking_confirmed: 75,
            delivered: 100, cancelled: 0, on_hold: 40,
        };
        return map[stage] ?? 0;
    };

    const activeOpportunity = activeId ? opportunities.find(o => o.id === activeId) : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div
                ref={containerRef}
                className={`kanban-scroll-container flex h-full gap-4 overflow-x-auto pb-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
                {...handlers}
            >
                <div className="kanban-scroll-area flex gap-4 min-w-max px-6">
                    {STAGES.map((stage) => (
                        <KanbanColumn
                            key={stage}
                            stage={stage}
                            opportunities={opportunities.filter((o) => o.stage === stage)}
                            onEdit={onEditOpportunity}
                            onDelete={onDeleteOpportunity}
                            onWinCase={onWinCase}
                            onLoseCase={onLoseCase}
                            onRefresh={onRefresh}
                        />
                    ))}
                </div>
            </div>

            <DragOverlay>
                {activeOpportunity ? <KanbanCard opportunity={activeOpportunity} /> : null}
            </DragOverlay>
        </DndContext>
    );
}
