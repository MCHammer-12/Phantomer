import { apiRequest } from "@/lib/queryClient";
import { Event, EventFormData, Grouping, GroupingUpdateData } from "@/types";
import { API_URL } from "../types/constants";

const API_BASE_URL = `${API_URL}/events`;

export async function createEvent(data: EventFormData): Promise<Event> {
  const res = await fetch(`${API_URL}/events/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name:data.eventName, url:data.eventUrl, row:data.row, section:data.section, groupSize:data.groupSize, expectedPrice:data.price }),
      });
  return res.json();
}

export async function getEvents(): Promise<Event[]> {
  const res = await fetch(`${API_BASE_URL}/all`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
     });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const payload = await res.json();
  // Unwrap events array
  const eventsArray: any[] = Array.isArray(payload) ? payload : payload.events;
  // Ensure each event has a groupings array
  return eventsArray.map(event => ({
    ...event,
    groupings: Array.isArray(event.groupings) ? event.groupings : [],
  }));
}

export async function refreshEventStatus(eventId: number): Promise<Event> {
  const response = await apiRequest("POST", `${API_BASE_URL}/events/${eventId}/refresh`, undefined);
  return response.json();
}

export async function updateGrouping(id: number, data: GroupingUpdateData): Promise<Grouping> {
  const response = await apiRequest("PATCH", `${API_BASE_URL}/groupings/${id}`, data);
  return response.json();
}

export async function deleteGrouping(id: number): Promise<void> {
  await apiRequest("DELETE", `${API_BASE_URL}/groupings/${id}`, undefined);
}

export async function deleteEvent(id: number): Promise<void> {
  await apiRequest("DELETE", `${API_BASE_URL}/events/${id}`, undefined);
}
