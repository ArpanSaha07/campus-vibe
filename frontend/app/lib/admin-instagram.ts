import { apiFetch } from "@/app/lib/api";
import type { AdminInstagram } from "@/app/types";

/** The admin dashboard's Instagram import section: `/api/v1/admin/instagram`. Platform admins only. */

export async function getAdminInstagram(): Promise<AdminInstagram> {
  return apiFetch<AdminInstagram>(`/api/v1/admin/instagram`, { auth: true });
}

/** Sets N: runs check the first N accounts of the ranked list. */
export async function setInstagramAccountCount(accountCount: number): Promise<AdminInstagram> {
  return apiFetch<AdminInstagram>(`/api/v1/admin/instagram/account-count`, {
    method: "PUT",
    body: JSON.stringify({ accountCount }),
    auth: true,
  });
}

/** Starts a run over the first N accounts now. 409 while a run is going. */
export async function startAdminInstagramImport(): Promise<AdminInstagram> {
  return apiFetch<AdminInstagram>(`/api/v1/admin/instagram/import`, { method: "POST", auth: true });
}
