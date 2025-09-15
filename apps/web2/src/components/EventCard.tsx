import { useState } from "react";
import { Event, Grouping, GroupingUpdateData } from "@/types";
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2,
  Save,
  X 
} from "lucide-react";
import GroupingStatus from "./GroupingStatus";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { updateGrouping, deleteGrouping, deleteEvent, refreshEvent, getEvent } from "@/services/api";
import { queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface EventCardProps {
  event: Event;
  onDelete: () => void;
}

export default function EventCard({ event, onDelete }: EventCardProps) {
  const toHref = (u?: string) => {
    const s = u ?? "";
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingGroupingId, setEditingGroupingId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: number, type: 'event' | 'grouping' } | null>(null);
  const [editFormData, setEditFormData] = useState<GroupingUpdateData>({});
  const [optimisticEvent, setOptimisticEvent] = useState<Event | null>(null);
  const currentEvent = optimisticEvent ?? event;
  const groupsFound = (currentEvent as any).groupCount ?? 0;

  const hasAvailableGroupings = currentEvent.groupings.some(
    (grouping) => grouping.isAvailable
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function refreshAndLoad(id: number) {
  setIsRefreshing(true);
  try {
    const r = await refreshEvent(id);
    // Poll a few times for updated availability
    let latest: Event | null = null;
    for (let i = 0; i < 5; i++) {
      await delay(400 + i * 300); // 400, 700, 1000, 1300, 1600ms
      latest = await getEvent(id);
      if (latest) break;
    }
    if (latest) {
      setOptimisticEvent({ ...latest, groupCount: typeof r?.groupCount === 'number' ? r.groupCount : (latest as any).groupCount });
      // Update only this event in the cached list
      queryClient.setQueryData(["/api/events"], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((e: Event) =>
            e.id === latest!.id
              ? { ...latest!, groupCount: typeof r?.groupCount === 'number' ? r.groupCount : (latest as any).groupCount }
              : e
          );
        }
        if (old && Array.isArray(old.events)) {
          return {
            ...old,
            events: old.events.map((e: Event) =>
              e.id === latest!.id
                ? { ...latest!, groupCount: typeof r?.groupCount === 'number' ? r.groupCount : (latest as any).groupCount }
                : e
            ),
          };
        }
        return old;
      });
    }
  } finally {
    setIsRefreshing(false);
  }
}

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const startEditing = (grouping: Grouping) => {
    setEditingGroupingId(grouping.id);
    setEditFormData({
      section: grouping.section as 'left' | 'center' | 'right',
      row: grouping.row,
      price: grouping.price ?? undefined,
      groupSize: grouping.groupSize
    });
  };

  const cancelEditing = () => {
    setEditingGroupingId(null);
    setEditFormData({});
  };

  const updateGroupingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GroupingUpdateData }) => 
      updateGrouping(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches for the list
      await queryClient.cancelQueries({ queryKey: ["/api/events"] });
      // Snapshot previous cache
      const prev = queryClient.getQueryData(["/api/events"]);

      // Optimistically update cached list (supports array or { events: [] } shapes)
      queryClient.setQueryData(["/api/events"], (old: any) => {
        if (!old) return old;
        const apply = (e: Event) => {
          if (e.id !== id) return e;
          const g = e.groupings?.[0];
          const updatedGrouping = g ? {
            ...g,
            section: (data.section ?? g.section) as any,
            row: data.row ?? g.row,
            price: typeof data.price === 'number' ? data.price : (g.price ?? undefined),
            groupSize: typeof data.groupSize === 'number' ? data.groupSize : (g.groupSize ?? undefined),
          } : undefined;
          return {
            ...e,
            groupings: updatedGrouping ? [updatedGrouping] : e.groupings,
          } as Event;
        };

        if (Array.isArray(old)) {
          return old.map(apply);
        }
        if (old && Array.isArray(old.events)) {
          return { ...old, events: old.events.map(apply) };
        }
        return old;
      });

      // Also optimistically close the editor locally
      setEditingGroupingId(null);

      // Locally reflect the changes on this card immediately
      const base = optimisticEvent ?? event;
      const g0 = base.groupings?.[0];
      if (g0) {
        const og = {
          ...g0,
          section: (data.section ?? g0.section) as any,
          row: data.row ?? g0.row,
          price: typeof data.price === 'number' ? data.price : g0.price,
          groupSize: typeof data.groupSize === 'number' ? data.groupSize : g0.groupSize,
        };
        setOptimisticEvent({ ...base, groupings: [og] });
      }

      // Return context for potential rollback
      return { prev };
    },
    onError: (error, _vars, ctx) => {
      // Rollback on error
      if (ctx?.prev) queryClient.setQueryData(["/api/events"], ctx.prev as any);
      setOptimisticEvent(null);
      toast({
        title: "Error",
        description: `Failed to update grouping: ${error.message}`,
        variant: "destructive",
      });
    },

    onSuccess: async () => {
      await refreshAndLoad(currentEvent.id);
      toast({
        title: "Grouping updated",
        description: "Event refreshed with new availability.",
      });
    },
  });

  const deleteGroupingMutation = useMutation({
    mutationFn: (id: number) => deleteGrouping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      toast({
        title: "Grouping deleted",
        description: "The grouping has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete grouping: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      setOptimisticEvent(null);
      toast({
        title: "Event deleted",
        description: "The event and all its groupings have been deleted successfully",
      });
      onDelete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete event: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleUpdateGrouping = (id: number) => {
    updateGroupingMutation.mutate({ id, data: editFormData });
  };

  const confirmDelete = (id: number, type: 'event' | 'grouping') => {
    setGroupToDelete({ id, type });
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (!groupToDelete) return;
    
    if (groupToDelete.type === 'grouping') {
      deleteGroupingMutation.mutate(groupToDelete.id);
    } else {
      deleteEventMutation.mutate(groupToDelete.id);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {currentEvent.eventUrl ? (
                  <a
                    href={toHref(currentEvent.eventUrl)}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={toHref(currentEvent.eventUrl)}
                  >
                    {currentEvent.eventName}
                  </a>
                ) : (
                  currentEvent.eventName
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Added on {formatDate(currentEvent.dateCreated)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  hasAvailableGroupings
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                }`}
              >
                {hasAvailableGroupings ? "Available" : "Unavailable"}
              </span>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                title="Groups found"
              >
                Groups: {groupsFound}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 h-7 w-7"
                onClick={() => confirmDelete(currentEvent.id, 'event')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 h-7 w-7"
                onClick={toggleExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronUp className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-6 py-4 overflow-x-hidden">
            <div className="flex overflow-x-auto pb-4 px-1 no-scrollbar">
              <div className="flex gap-4 flex-nowrap">
                {currentEvent.groupings.map((grouping) => (
                  <div
                    key={grouping.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-[280px] flex-shrink-0"
                  >
                    {editingGroupingId === grouping.id ? (
                      // Edit form
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Section</label>
                            <Select
                              value={editFormData.section}
                              onValueChange={(value) => 
                                setEditFormData({...editFormData, section: value as "left" | "center" | "right"})
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Row</label>
                            <Input
                              value={editFormData.row}
                              onChange={(e) => 
                                setEditFormData({...editFormData, row: e.target.value})
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Price</label>
                            <Input
                              type="number"
                              value={editFormData.price}
                              onChange={(e) => 
                                setEditFormData({...editFormData, price: parseFloat(e.target.value)})
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Group Size</label>
                            <Input
                              type="number"
                              value={editFormData.groupSize}
                              onChange={(e) => 
                                setEditFormData({...editFormData, groupSize: parseInt(e.target.value)})
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={cancelEditing}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateGrouping(grouping.id)}
                            disabled={updateGroupingMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display view
                      <div className="p-3">
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {grouping.section} Section, Row {grouping.row}
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                          <div>
                            <p className="font-semibold">Price</p>
                            <p className="text-sm font-medium dark:text-gray-300"> {grouping.price != null ? `$${grouping.price.toFixed(2)}` : '—'} </p>
                          </div>
                          <div>
                            <p className="font-semibold">Group Size</p>
                            <p className="text-sm font-medium dark:text-gray-300">{grouping.groupSize}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <GroupingStatus grouping={grouping} />
                          
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 px-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                              onClick={() => startEditing(grouping)}
                            >
                              <Edit className="h-3 w-3 mr-1.5" />
                              <span className="text-xs font-medium">Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 px-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => confirmDelete(grouping.id, 'grouping')}
                            >
                              <Trash2 className="h-3 w-3 mr-1.5" />
                              <span className="text-xs font-medium">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              {groupToDelete?.type === 'event' ? 
                'Are you sure you want to delete this event and all its groupings?' : 
                'Are you sure you want to delete this grouping?'
              }
            </p>
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteGroupingMutation.isPending || deleteEventMutation.isPending}
            >
              {deleteGroupingMutation.isPending || deleteEventMutation.isPending ? 
                "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}