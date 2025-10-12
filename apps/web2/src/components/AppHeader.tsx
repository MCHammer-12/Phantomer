import { RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import NotificationsPanel from "./NotificationsPanel";
import { SettingSelect } from "./SettingSelect";
import { Event } from "@/types";
import { API_URL } from "@/types/constants";

interface AppHeaderProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  events: Event[];
  successMessage: string | null;
  errorMessage: string | null;
  lastUpdated: string;
}

export default function AppHeader({
  onRefresh,
  isRefreshing,
  events,
  successMessage,
  errorMessage,
  lastUpdated
}: AppHeaderProps) {

  const handleRefresh = async () => {
    try {
      await onRefresh();
    } catch (err: any) {
      console.error("Refresh failed:", err.message);
    }
  };


  //const [lastUpdated, setLastUpdated] = useState<string>("Never");
  

  //const hasLoadedEvents = useRef(false);

  // useEffect(() => {
  //   // On mount, load the last persisted update timestamp
  //   fetch(`${API_URL}/events/last-updated`, { cache: 'no-store' })
  //     .then(res => {
  //       if (!res.ok) {
  //         throw new Error(`HTTP ${res.status}`);
  //       }
  //       return res.json();
  //     })
  //     .then(({ lastUpdated }) => {
  //       if (lastUpdated) {
  //         setLastUpdated(
  //           new Date(lastUpdated).toLocaleTimeString(undefined, {
  //             hour: "numeric",
  //             minute: "2-digit",
  //             hour12: true,
  //           })
  //         );
  //       }
  //     })
  //     .catch(() => {
  //       // Leave lastUpdated as "Never" on failure
  //     });
  // }, []);

  // useEffect(() => {
  //   if (!isRefreshing && events.length > 0) {
  //     if (hasLoadedEvents.current) {
  //       const time = new Date().toLocaleTimeString(undefined, {
  //         hour: "numeric",
  //         minute: "2-digit",
  //         hour12: true,
  //       });
  //       setLastUpdated(time);
  //     } else {
  //       // Skip the initial load
  //       hasLoadedEvents.current = true;
  //     }
  //   }
  // }, [events, isRefreshing]);

  return (
    <header className="bg-brand-black text-secondary-foreground shadow sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-brand-anti">
            Ticket Checker
          </h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground">
              Last updated: {isRefreshing ? "Updating..." : lastUpdated}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-full"
            >
              <RefreshCw
                className={`h-5 w-5 text-muted-foreground ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
            </Button>
            <div aria-live="polite" className="min-w-[8rem]">
              {successMessage && (
                <span role="status" className="text-green-600 text-sm">
                  {successMessage}
                </span>
              )}
              {errorMessage && (
                <span role="alert" className="text-red-600 text-sm">
                  {errorMessage}
                </span>
              )}
            </div>
            <NotificationsPanel 
              events={events}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
            
            <SettingSelect />
          </div>
        </div>
      </div>
    </header>
  );
}
