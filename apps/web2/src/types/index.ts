export interface Event {
  id: number;
  eventName: string;
  eventUrl: string;
  dateCreated: string;
  groupings: Grouping[];
}

export interface Grouping {
  id: number;
  eventId: number;
  section: "Left" | "Center" | "Right";
  row: string;
  price: number;
  groupSize: number;
  isAvailable: boolean;
  groupsFound: number;
}

export interface EventFormData {
  eventName: string;
  eventUrl: string;
  row: string;
  section: string;
  price: number;
  groupSize: number;
  tag?: string;
}

export interface SortOption {
  value: "dateCreated" | "eventDate" | "availability";
  label: string;
}

export interface FilterOption {
  value: "all" | "available" | "unavailable";
  label: string;
}

export interface GroupingUpdateData {
  section?: "Left" | "Center" | "Right";
  row?: string;
  price?: number;
  groupSize?: number;
  isAvailable?: boolean;
  groupsFound?: number;
}
