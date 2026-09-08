import { redirect } from "next/navigation";

/**
 * The old single-club dashboard.
 *
 * It assumed one club per admin — `getMyClub()` against `/clubs/my-club`, which
 * could only ever answer with one. Club management is now per-club and a user
 * may manage several, so the dashboard lives at `/manage/[clubId]` and this
 * route forwards to the picker, which goes straight through when there is only
 * one club to pick.
 *
 * Kept rather than deleted because this path is in people's history and may be
 * bookmarked. A permanent redirect would be cached by the browser, which is
 * hard to undo if the route is ever reused — so this is the default temporary
 * one.
 */
export default function ClubDashboardRedirect() {
  redirect("/manage");
}
