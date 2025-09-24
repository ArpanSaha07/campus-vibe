"use client";
import { Bell, User } from "lucide-react";
import { User as UserType } from "@/app/types";

export default function UserProfileNavbar({ user }: { user: UserType }) {
  return (
    <nav className="flex justify-between items-center p-4 border-b shadow-sm">
      <h1 className="text-xl font-bold text-orange-600">CampusVibe</h1>
      <div className="flex gap-4 items-center">
        <button aria-label="Notifications">
          <Bell className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
            {user?.name?.[0] || <User className="w-5 h-5" />}
          </div>
          <span>{user.name}</span>
        </div>
      </div>
    </nav>
  );
}
