import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import NotificationsPanel from "./NotificationsPanel";
import { ThemeToggle } from "./ThemeToggle";
import { Event } from "@/types";

interface AppHeaderProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  events: Event[];
}

export default function AppHeader({ onRefresh, isRefreshing, events }: AppHeaderProps) {
  const [lastUpdated, setLastUpdated] = useState<string>("Never");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isRefreshing) {
      setLastUpdated(
        new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    }
  }, [isRefreshing]);

  const handleRefresh = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await onRefresh();
      const time = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setSuccessMessage(`Events updated successfully`);
    } catch (err: any) {
      setErrorMessage(`Refresh failed: ${err.message}`);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Ticket Monitoring System
          </h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {isRefreshing ? "Updating..." : lastUpdated}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-full"
            >
              <RefreshCw
                className={`h-5 w-5 text-gray-500 dark:text-gray-400 ${
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
            
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
