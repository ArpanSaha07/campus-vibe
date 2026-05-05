import { apiFetch } from '@/app/lib/api';
import { API_ENDPOINTS } from '@/app/constants/endpoints';
import { popularEvents } from '@/app/constants/mock-data';
import type { EventInstance } from '@/app/types';

// Get all events (with fallback to mock data)
export async function getEvents(): Promise<EventInstance[]> {
  try {
    return await apiFetch<EventInstance[]>(API_ENDPOINTS.EVENTS.LIST);
  } catch (error) {
    console.warn('Failed to fetch events from API, using mock data:', error);
    return popularEvents;
  }
}

// Get event by ID
export async function getEventById(id: number): Promise<EventInstance> {
  try {
    return await apiFetch<EventInstance>(API_ENDPOINTS.EVENTS.DETAIL.replace(':id', String(id)));
  } catch (error) {
    // Fallback to mock data
    const event = popularEvents.find(e => e.id === id);
    if (event) return event;
    throw error;
  }
}

// Get user's events
export async function getUserEvents(): Promise<EventInstance[]> {
  try {
    return await apiFetch<EventInstance[]>(API_ENDPOINTS.USERS.EVENTS, { auth: true });
  } catch (error) {
    console.warn('Failed to fetch user events:', error);
    return [];
  }
}

// Register for an event
export async function registerForEvent(eventId: number): Promise<void> {
  return apiFetch<void>(
    API_ENDPOINTS.EVENTS.REGISTER.replace(':id', String(eventId)),
    { method: 'POST', auth: true }
  );
}

// Unregister from an event
export async function unregisterFromEvent(eventId: number): Promise<void> {
  return apiFetch<void>(
    API_ENDPOINTS.EVENTS.UNREGISTER.replace(':id', String(eventId)),
    { method: 'POST', auth: true }
  );
}

// Search events
export async function searchEvents(query: string): Promise<EventInstance[]> {
  try {
    return await apiFetch<EventInstance[]>(
      `${API_ENDPOINTS.EVENTS.SEARCH}?q=${encodeURIComponent(query)}`
    );
  } catch (error) {
    console.warn('Failed to search events:', error);
    return [];
  }
}
