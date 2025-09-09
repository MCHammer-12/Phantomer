// import { apiRequest } from "@/lib/queryClient";
import { Event, EventFormData, Grouping, GroupingUpdateData } from "@/types";
import { API_URL } from "../types/constants";

const API_BASE_URL = `${API_URL}/events`;

export async function createEvent(data: EventFormData): Promise<Event> {
  const res = await fetch(`${API_URL}/events/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: data.eventName,
      url: data.eventUrl,
      row: data.row,
      section: data.section,
      groupSize: data.groupSize,
      expectedPrice: data.price,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create event: ${res.status}`);
  }
  // Unwrap payload and return only the event object
  const payload: { message: string; event: Event } = await res.json();
  return payload.event;
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

export async function refreshAllEvents(): Promise<{ errorsOccurred: boolean }> {
  const res = await fetch(`${API_URL}/events/refresh`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to refresh events: ${res.status}`);
  }
  const payload = await res.json();
  return { errorsOccurred: payload.errorsOccurred === true };
}

/**
 * Trigger a refresh of just one event’s XML data.
 */
export async function refreshEvent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/${id}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh event ${id}: ${res.status}`);
  }
}

export async function getEvent(id: number): Promise<Event> {
  const res = await fetch(`${API_BASE_URL}/by-id/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch event ${id}: ${res.status}`);
  }
  const evt = await res.json();
  // Ensure groupings array exists
  return {
    ...evt,
    groupings: Array.isArray(evt.groupings) ? evt.groupings : [],
  } as Event;
}

export async function updateGrouping(id: number, data: GroupingUpdateData): Promise<Grouping> {
  const res = await fetch(`${API_BASE_URL}/groupings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to update grouping: ${res.status}`);
  }
  return res.json();
}

export async function deleteGrouping(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/groupings/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete grouping: ${res.status}`);
  }
}

export async function deleteEvent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete event: ${res.status}`);
  }
}
