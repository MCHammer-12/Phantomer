import { Check, X } from "lucide-react";
import { Grouping } from "@/types";

interface GroupingStatusProps {
  grouping: Grouping;
  className?: string;
}

export default function GroupingStatus({ grouping, className = "" }: GroupingStatusProps) {
  const { isAvailable, groupsFound } = grouping;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div 
        className={`flex items-center justify-center px-3 py-1.5 rounded-full w-full ${
          isAvailable ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"
        }`}
      >
        {isAvailable ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-1.5" />
        ) : (
          <X className="h-4 w-4 text-red-600 dark:text-red-400 mr-1.5" />
        )}
        <span
          className={`text-sm font-medium ${
            isAvailable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {isAvailable ? "Available" : "Unavailable"}
        </span>
      </div>
      
      <div
        className={`flex items-center justify-center px-3 py-1.5 rounded-full w-full ${
          isAvailable
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        <span className="text-xs font-semibold">
          {groupsFound} {groupsFound === 1 ? "group" : "groups"} found
        </span>
      </div>
    </div>
  );
}
