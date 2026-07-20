"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/app/components/SearchBar";
import { useAuth } from "@/app/lib/auth-context";

// notes: fix spacing of items in desktop view; work on search functionality

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  // const { isAuthenticated, logout } = useAuth();
  const isAuthenticated = false;
  const logout = () => {
    // Implement logout logic here
    console.log("Logged out");
  }

  return (
    <nav className="w-full border-b border-gray-200 bg-white top-0 z-50">
      <div className="px-4 mb-1 sm:px-6 lg:px-8">
        {/* Top Row */}
        <div className="flex h-16 items-center justify-between space-x-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <Image
                src="/campus-vibe-logo.png"
                alt="Logo"
                width={150}
                height={60}
                priority={true}
              />
            </Link>
          </div>

          {/* Search bar (inline on md+, shrinks with flex) */}
          <div className="flex-1 hidden lg:flex">
            <SearchBar className="w-full max-w-3xl" />
          </div>

          {/* Desktop Links */}
          <div className="hidden xl:flex space-x-2 items-center text-sm font-medium whitespace-nowrap">
            <Link href="/events" className="p-3 rounded-full hover:bg-gray-100">
              Find Events
            </Link>
            <Link href="/clubs" className="p-3 rounded-full hover:bg-gray-100">
              Find Clubs
            </Link>
            <Link href="/create-event" className="p-3 rounded-full hover:bg-gray-100">
              Create Event
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/my-events" className="p-3 rounded-full hover:bg-gray-100">My Events</Link>
                <Link href="/my-profile" className="p-3 rounded-full hover:bg-gray-100">My Profile</Link>
                <button
                  onClick={logout}
                  className="p-3 rounded-full hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="p-3 rounded-full hover:bg-gray-100">Log In</Link>
                <Link
                  href="/login"
                  className="px-3 py-1 font-bold border-2 rounded-2xl border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right Side (Few items + Hamburger) */}
          <div className="flex xl:hidden items-center space-x-2 text-sm font-medium">
            <Link href="/events" className="p-3 rounded-full hover:bg-gray-100">Find events</Link>
            {isAuthenticated ? (
              <Link href="/my-events" className="p-3 rounded-full hover:bg-gray-100">My events</Link>
            ) : (
              <>
                <Link href="/login" className="p-3 rounded-full hover:bg-gray-100">
                  Log In
                </Link>
                <Link href="/login" className="p-3 rounded-full hover:bg-gray-100">
                  Sign Up
                </Link>
              </>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-3 rounded-full hover:bg-gray-100"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search bar (second row for mobile only) */}
        <div className="w-full py-2 lg:hidden">
          <SearchBar />
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="xl:hidden mt-1 space-y-2 mb-2">
            <Link href="/clubs" className="block p-2 hover:text-orange-600 hover:bg-gray-100">
              Find Clubs
            </Link>
            <Link href="/create-event" className="block p-2 hover:text-orange-600 hover:bg-gray-100">
              Create Event
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/my-profile" className="block p-2 hover:text-orange-600 hover:bg-gray-100">
                  My Profile
                </Link>
                <button
                  onClick={logout}
                  className="block w-full text-left p-2 hover:text-orange-600 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}