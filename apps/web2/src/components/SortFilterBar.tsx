import { FilterOption, SortOption } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SortFilterBarProps {
  sortOptions: SortOption[];
  filterOptions: FilterOption[];
  selectedSort: string;
  selectedFilter: string;
  onSortChange: (value: string) => void;
  onFilterChange: (value: string) => void;
}

export default function SortFilterBar({
  sortOptions,
  filterOptions,
  selectedSort,
  selectedFilter,
  onSortChange,
  onFilterChange,
}: SortFilterBarProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold dark:text-white">Monitored Events</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Select value={selectedSort} onValueChange={onSortChange}>
              <SelectTrigger className="w-full sm:w-[180px] dark:bg-neutral-700 dark:text-white dark:border-gray-600">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="dark:bg-neutral-800 dark:border-gray-700">
                {sortOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="dark:text-gray-200 dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Select value={selectedFilter} onValueChange={onFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px] dark:bg-neutral-700 dark:text-white dark:border-gray-600">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="dark:bg-neutral-800 dark:border-gray-700">
                {filterOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="dark:text-gray-200 dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
