import { useState } from "react";
import { Event, Grouping, GroupingUpdateData } from "@/types";
import { 
  ChevronDown, 
  ChevronUp, 
  Link as LinkIcon, 
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
import { updateGrouping, deleteGrouping, deleteEvent } from "@/services/api";
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
}

export default function EventCard({ event }: EventCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingGroupingId, setEditingGroupingId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: number, type: 'event' | 'grouping' } | null>(null);
  const [editFormData, setEditFormData] = useState<GroupingUpdateData>({});

  const hasAvailableGroupings = event.groupings.some(
    (grouping) => grouping.isAvailable
  );

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const startEditing = (grouping: Grouping) => {
    setEditingGroupingId(grouping.id);
    setEditFormData({
      section: grouping.section as "Left" | "Center" | "Right",
      row: grouping.row,
      price: grouping.price,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEditingGroupingId(null);
      setEditFormData({});
      toast({
        title: "Grouping updated",
        description: "The grouping has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update grouping: ${error.message}`,
        variant: "destructive",
      });
    }
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
      toast({
        title: "Event deleted",
        description: "The event and all its groupings have been deleted successfully",
      });
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
                {event.eventName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Added on {formatDate(event.dateCreated)}
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
              
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 h-7 w-7"
                onClick={() => confirmDelete(event.id, 'event')}
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
          <div className="px-6 py-4">
            <div className="flex items-center mb-4">
              <LinkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-1" />
              <a
                href={event.eventUrl}
                className="text-primary hover:underline text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                {event.eventUrl}
              </a>
            </div>

            <div className="flex overflow-x-auto pb-4 -mx-1 px-1">
              <div className="flex gap-4 flex-nowrap">
                {event.groupings.map((grouping) => (
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
                                setEditFormData({...editFormData, section: value as "Left" | "Center" | "Right"})
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Left">Left</SelectItem>
                                <SelectItem value="Center">Center</SelectItem>
                                <SelectItem value="Right">Right</SelectItem>
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
                            <p className="text-sm font-medium dark:text-gray-300">${grouping.price.toFixed(2)}</p>
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