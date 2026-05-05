'use client';

import { useAsync } from './useAsync';
import { getEvents, getEventById } from '@/app/services/events.service';
import type { EventInstance } from '@/app/types';

export function useEvents() {
  return useAsync<EventInstance[]>(() => getEvents());
}

export function useEventById(id: number) {
  return useAsync<EventInstance>(() => getEventById(id), !!id);
}
