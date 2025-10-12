import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import EventForm from "@/components/EventForm";
import SortFilterBar from "@/components/SortFilterBar";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Event, FilterOption, SortOption } from "@/types";
import { FileText } from "lucide-react";
import { API_URL } from '@/types/constants';
import { refreshAllEvents } from "@/services/api";


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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<string>("dateCreated");
  const [filterOption, setFilterOption] = useState<string>("all");
  // add usestate hooks 
  //one hook to hold array of events
  const [events, setEvents] = useState<Event[]>([]);
  //one hook for loading tracking
  const [isLoading, setIsLoading] = useState<boolean>(true);
  //one for errors
  const [error, setError] = useState<string | null>(null);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // --- User management state (stored locally) ---
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState<string>("");

  const USERS_KEY = "tc_users";
  const CURRENT_USER_KEY = "tc_current_user";

  const loadUsers = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      if (Array.isArray(saved)) setUsers(saved);
      const cur = localStorage.getItem(CURRENT_USER_KEY);
      if (cur) setSelectedUser(cur);
    } catch {
      // ignore
    }
  };

  const saveUsers = (list: string[]) => {
    setUsers(list);
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  };

  const addUser = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (users.includes(trimmed)) return;
    const next = [...users, trimmed];
    saveUsers(next);
    setNewUserName("");
  };

  const removeUser = (name: string) => {
    const next = users.filter(u => u !== name);
    saveUsers(next);
    if (selectedUser === name) {
      setSelectedUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  };

  const chooseUser = async (name: string) => {
    setSelectedUser(name);
    localStorage.setItem(CURRENT_USER_KEY, name);
    await fetchEvents(name);
    await fetchLastUpdated();
  };

const fetchLastUpdated = async () => {
  console.log("Calling fetchLastUpdated()");
  try {
    const res = await fetch(`${API_URL}/events/last-updated`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { lastUpdated } = await res.json();
    if (lastUpdated) {
      const formatted = new Date(lastUpdated).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setLastUpdated(formatted);
      console.log("Fetched lastUpdated at mount:", formatted);
    }
  } catch (err) {
    console.error("Failed to fetch last updated", err);
  }
};


// Fetch events and update state
const fetchEvents = async (userTag?: string) => {
  setIsLoading(true);
  setError(null);
  try {
    const url = userTag
      ? `${API_URL}/events/all?userTag=${encodeURIComponent(userTag)}`
      : `${API_URL}/events/all`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
    const eventsArray = await res.json();
    setEvents(eventsArray);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setIsLoading(false);
  }
};

  // add useeffect to call async fetch function
  useEffect(() => {
    console.log("Dashboard useEffect initializing…");
    loadUsers();
    const initialize = async () => {
      const cur = localStorage.getItem(CURRENT_USER_KEY) || undefined;
      await fetchEvents(cur);
      await fetchLastUpdated();
    };
    initialize();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await refreshAllEvents(); // returns { errorsOccurred: boolean }
      await fetchEvents(selectedUser || undefined);
      await fetchLastUpdated();

      if (result.errorsOccurred) {
        setErrorMessage('Events not updated. Try again later');
      } else {
        setSuccessMessage('Events refreshed successfully');
      }
    } catch (err) {
      setError((err as Error).message);
      setErrorMessage(`Full refresh failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (value: string) => {
    setSortOption(value);
  };

  const handleFilterChange = (value: string) => {
    setFilterOption(value);
  };

  const handleEventDelete = (deletedId: number) => {
    setEvents(prev => prev.filter(e => e.id !== deletedId));
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
    <div className="bg-card text-card-foreground border border-border shadow rounded-lg p-8 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium text-card-foreground mb-2">
        No events being monitored
      </h3>
      <p className="text-muted-foreground mb-4">
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
      <h3 className="text-lg font-medium text-white mb-2">Select User</h3>

      {/* Existing users */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {users.length === 0 ? (
          <span className="text-muted-foreground">No users yet — add one below.</span>
        ) : (
          users.map((u) => (
            <Button
              key={u}
              onClick={() => chooseUser(u)}
              variant="secondary"
              className="dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {u}
            </Button>
          ))
        )}
      </div>

      {/* Add user inline */}
      <div className="flex items-center justify-center gap-2">
        <input
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          placeholder="Add user (e.g., Michael)"
          className="px-3 py-2 rounded-md bg-neutral-700 text-white placeholder:text-neutral-400 focus:outline-none"
        />
        <Button
          onClick={() => addUser(newUserName)}
          className="dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          Add
        </Button>
      </div>

      {/* Fallback to plain refresh */}
      <div className="mt-4">
        <Button onClick={handleRefresh} className="dark:bg-blue-700 dark:hover:bg-blue-600">Load Events</Button>
      </div>
    </div>
  );

  console.log("Rendering Dashboard — passing lastUpdated:", lastUpdated, "selectedUser:", selectedUser);

  return (
    <div className="min-h-screen bg-brand-outer">
      <AppHeader 
        onRefresh={handleRefresh} 
        isRefreshing={isLoading} 
        events={events} 
        successMessage={successMessage}
        errorMessage={errorMessage}
        lastUpdated={lastUpdated ?? "Never"}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-nowrap gap-6 overflow-x-auto">
          <EventForm onSuccess={() => fetchEvents(selectedUser || undefined)} currentUser={selectedUser || undefined} />

          <div className="flex-1 min-w-0">
            {/* Settings panel for managing users */}

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
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onDelete={() => handleEventDelete(event.id)} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
