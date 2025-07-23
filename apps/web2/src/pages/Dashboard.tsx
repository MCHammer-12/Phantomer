import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEvents } from "@/services/api";
import AppHeader from "@/components/AppHeader";
import EventForm from "@/components/EventForm";
import SortFilterBar from "@/components/SortFilterBar";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Event, FilterOption, SortOption } from "@/types";
import { queryClient } from "@/lib/queryClient";
import { FileText } from "lucide-react";

const sortOptions: SortOption[] = [
  { value: "dateCreated", label: "Sort by Date Created" },
  { value: "eventDate", label: "Sort by Event Date" },
  { value: "availability", label: "Sort by Availability" },
];

const filterOptions: FilterOption[] = [
  { value: "all", label: "Show All" },
  { value: "available", label: "Available Only" },
  { value: "unavailable", label: "Unavailable Only" },
];

export default function Dashboard() {
  const [sortOption, setSortOption] = useState<string>("dateCreated");
  const [filterOption, setFilterOption] = useState<string>("all");
  // add usestate hooks 
  //one hook to hold array of events
  const [events, setEvents] = useState<Event[]>([]);
  //one hook for loading tracking
  const [isLoading, setIsLoading] = useState<boolean>(true);
  //one for errors
  const [error, setError] = useState<string | null>(null);

  // add useeffect to call async fetch function
  useEffect(() => {
    async function fetchEvents() {
      //isloading=true
      setIsLoading(true);
      //call getevents
      try {
        const eventsArray = await getEvents();
        //on success call setevents
        setEvents(eventsArray);
        //on failure call seterror
      } catch (err) {
        setError((err as Error).message);
         //set isloading to false
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, []);


  
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  };

  const handleSortChange = (value: string) => {
    setSortOption(value);
  };

  const handleFilterChange = (value: string) => {
    setFilterOption(value);
  };

  // Type guard: Ensure events is an array before proceeding
  if (!Array.isArray(events)) {
    console.warn("Events state is not an array:", events);
    return <div>Loading events...</div>;
  }
  // Apply sorting
  const sortedEvents = [...events].sort((a: Event, b: Event) => {
    if (sortOption === "dateCreated") {
      return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
    } else if (sortOption === "availability") {
      const aAvailable = a.groupings.some((g) => g.isAvailable);
      const bAvailable = b.groupings.some((g) => g.isAvailable);
      return aAvailable === bAvailable ? 0 : aAvailable ? -1 : 1;
    }
    // Default to dateCreated if eventDate
    return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
  });

  // Apply filtering
  const filteredEvents = sortedEvents.filter((event: Event) => {
    if (filterOption === "all") return true;
    const hasAvailableGroupings = event.groupings.some((g) => g.isAvailable);
    return filterOption === "available" ? hasAvailableGroupings : !hasAvailableGroupings;
  });

  // Empty state component
  const EmptyState = () => (
    <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-8 text-center">
      <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No events being monitored
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        Add your first event using the form to start monitoring ticket
        availability.
      </p>
    </div>
  );

  // Loading state component
  const LoadingState = () => (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin h-10 w-10 border-4 border-primary dark:border-blue-500 rounded-full border-t-transparent"></div>
    </div>
  );

  // Error state component
  const ErrorState = ({ message }: { message: string }) => (
    <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-8 text-center">
      <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Error loading events</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      <Button onClick={handleRefresh} className="dark:bg-blue-700 dark:hover:bg-blue-600">Try Again</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader 
        onRefresh={handleRefresh} 
        isRefreshing={isLoading} 
        events={events} 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-nowrap gap-6 overflow-x-auto">
          <EventForm onSuccess={handleRefresh} />

          <div className="flex-1 min-w-0">
            <SortFilterBar
              sortOptions={sortOptions}
              filterOptions={filterOptions}
              selectedSort={sortOption}
              selectedFilter={filterOption}
              onSortChange={handleSortChange}
              onFilterChange={handleFilterChange}
            />

            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : filteredEvents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-6 custom-scrollbar overflow-y-auto max-h-[calc(100vh-220px)]">
                {filteredEvents.map((event: Event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
