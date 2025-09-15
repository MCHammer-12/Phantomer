export type Section = "left" | "center" | "right";

export interface Event {
  id: number;
  eventName: string;
  dateCreated: string;
  groupings: Grouping[];
  groupCount?: number;

  // Canonical identifiers for seat map URL
  eventUrl?: string;       // for EventCard link
  performanceId?: string;  // derived by backend
  screenId?: number;
  facilityId?: number;

  // Optional legacy field for any old UI that still references it
  // eventUrl?: string;
}

export interface Grouping {
  id: number;
  eventId?: number;
  section: Section;
  row: string;
  price: number | null;
  groupSize: number;
  isAvailable: boolean;
  groupsFound?: number;
}

export interface EventFormData {
  eventName: string;
  eventUrl: string;      // user-provided URL; backend extracts performanceId
  screenId: number;      // 1..5 (Floor Section)
  row: string;
  section: Section;      // 'left' | 'center' | 'right'
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