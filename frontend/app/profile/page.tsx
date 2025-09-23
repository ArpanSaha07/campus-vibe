// app/profile/page.tsx
import { redirect } from "next/navigation";
import Navbar from "@/app/components/user-profile-page-components/UserProfileNavbar";
import EventList from "@/app/components/user-profile-page-components/UserProfileEventList";
import { getCurrentUser } from "@/lib/auth"; // your custom auth check

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <main className="flex flex-col items-center p-6">
        <div className="w-full max-w-6xl">
          <h1 className="text-4xl font-bold mb-4">Events</h1>
          <EventList />
        </div>
      </main>
    </div>
  );
}
