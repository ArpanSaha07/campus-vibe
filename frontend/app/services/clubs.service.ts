import { apiFetch } from '@/app/lib/api';
import { API_ENDPOINTS } from '@/app/constants/endpoints';
import { clubs } from '@/app/constants/mock-data';
import type { Club } from '@/app/types';

// Get all clubs (with fallback to mock data)
export async function getClubs(): Promise<Club[]> {
  try {
    return await apiFetch<Club[]>(API_ENDPOINTS.CLUBS.LIST);
  } catch (error) {
    console.warn('Failed to fetch clubs from API, using mock data:', error);
    return clubs;
  }
}

// Get club by ID
export async function getClubById(id: string): Promise<Club> {
  try {
    return await apiFetch<Club>(API_ENDPOINTS.CLUBS.DETAIL.replace(':id', id));
  } catch (error) {
    // Fallback to mock data
    const club = clubs.find(c => c.id === id);
    if (club) return club;
    throw error;
  }
}

// Get club events
export async function getClubEvents(clubId: string) {
  try {
    return await apiFetch(API_ENDPOINTS.CLUBS.EVENTS.replace(':id', clubId));
  } catch (error) {
    console.warn('Failed to fetch club events:', error);
    return [];
  }
}

// Follow a club
export async function followClub(clubId: string): Promise<void> {
  return apiFetch<void>(
    API_ENDPOINTS.CLUBS.FOLLOW.replace(':id', clubId),
    { method: 'POST', auth: true }
  );
}

// Unfollow a club
export async function unfollowClub(clubId: string): Promise<void> {
  return apiFetch<void>(
    API_ENDPOINTS.CLUBS.UNFOLLOW.replace(':id', clubId),
    { method: 'POST', auth: true }
  );
}
