'use client';

import { useAsync } from './useAsync';
import { getClubs, getClubById } from '@/app/services/clubs.service';
import type { Club } from '@/app/types';

export function useClubs() {
  return useAsync<Club[]>(() => getClubs());
}

export function useClubById(id: string) {
  return useAsync<Club>(() => getClubById(id), !!id);
}
