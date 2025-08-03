export type Section = "Left" | "Center" | "Right";

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
  section: Section;
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
  section: Section;
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
  section?: Section;
  row?: string;
  price?: number;
  groupSize?: number;
  isAvailable?: boolean;
  groupsFound?: number;
}
