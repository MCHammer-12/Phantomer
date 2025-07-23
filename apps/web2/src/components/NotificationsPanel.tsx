import { useState, useEffect } from "react";
import { 
  Bell, 
  X, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  RotateCw,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Event, Grouping, GroupingUpdateData } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { updateGrouping, deleteGrouping, deleteEvent } from "@/services/api";
import { queryClient } from "@/lib/queryClient";

interface NotificationsPanelProps {
  events: Event[];
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
}

export default function NotificationsPanel({ 
  events, 
  isRefreshing,
  onRefresh 
}: NotificationsPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingGroupingId, setEditingGroupingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<GroupingUpdateData>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});

  // Get all unavailable groupings
  const unavailableEvents = events?.filter(event => 
    event.groupings.some(grouping => !grouping.isAvailable)
  ) || [];

  // Initialize expanded state for each event
  useEffect(() => {
    const initialExpandedState: Record<number, boolean> = {};
    unavailableEvents.forEach(event => {
      initialExpandedState[event.id] = true;
    });
    setExpandedEvents(initialExpandedState);
  }, [unavailableEvents.length]);

  const toggleEventExpanded = (eventId: number) => {
    setExpandedEvents({
      ...expandedEvents,
      [eventId]: !expandedEvents[eventId]
    });
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

  const handleDeleteGrouping = (id: number) => {
    if (confirm("Are you sure you want to delete this grouping?")) {
      deleteGroupingMutation.mutate(id);
    }
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm("Are you sure you want to delete this event and all its groupings?")) {
      deleteEventMutation.mutate(id);
    }
  };

  const countUnavailableGroupings = () => {
    return unavailableEvents.reduce((count, event) => {
      return count + event.groupings.filter(g => !g.isAvailable).length;
    }, 0);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          {countUnavailableGroupings() > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {countUnavailableGroupings()}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl font-bold text-center">
            😱 Crap, These Ones Are Gone — Let's Take Care of It
          </SheetTitle>
          <SheetDescription className="text-center">
            These tickets are no longer available. You can edit or remove them from monitoring.
          </SheetDescription>
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh} 
              disabled={isRefreshing}
              className="mt-2"
            >
              <RotateCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Status
            </Button>
          </div>
        </SheetHeader>
        
        {unavailableEvents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-medium dark:text-gray-100">All clear!</h3>
            <p className="text-gray-500 dark:text-gray-400">All your monitored tickets are currently available.</p>
          </div>
        ) : (
          unavailableEvents.map(event => (
            <div key={event.id} className="mb-6 border rounded-lg overflow-hidden">
              <div 
                className="flex justify-between items-center p-3 bg-slate-50 dark:bg-gray-800 cursor-pointer"
                onClick={() => toggleEventExpanded(event.id)}
              >
                <div>
                  <h3 className="font-medium dark:text-gray-100">{event.eventName}</h3>
                  <a 
                    href={event.eventUrl} 
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {event.eventUrl}
                  </a>
                </div>
                <div className="flex items-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="text-xs">Delete All</span>
                  </Button>
                  {expandedEvents[event.id] ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
              </div>

              {expandedEvents[event.id] && event.groupings
                .filter(grouping => !grouping.isAvailable)
                .map(grouping => (
                  <div key={grouping.id} className="p-3 border-t">
                    {editingGroupingId === grouping.id ? (
                      // Edit form
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Section</label>
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
                            <label className="text-xs text-gray-500">Row</label>
                            <Input
                              value={editFormData.row}
                              onChange={(e) => 
                                setEditFormData({...editFormData, row: e.target.value})
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Price</label>
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
                            <label className="text-xs text-gray-500">Group Size</label>
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
                      <div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Section</span>
                            <p className="text-sm font-medium dark:text-gray-200">{grouping.section}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Row</span>
                            <p className="text-sm font-medium">{grouping.row}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Price</span>
                            <p className="text-sm font-medium">${grouping.price.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Group Size</span>
                            <p className="text-sm font-medium">{grouping.groupSize}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <X className="h-3 w-3 mr-1" /> Unavailable
                          </span>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-blue-600"
                              onClick={() => startEditing(grouping)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span className="text-xs">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600"
                              onClick={() => handleDeleteGrouping(grouping.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              <span className="text-xs">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          ))
        )}
      </SheetContent>
    </Sheet>
  );
}