"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/lib/auth-context";
import { isAdmin, isClubAdmin } from "@/app/lib/user";
import SearchBar from "@/app/components/SearchBar";
import Button from "@/app/components/ui/Button";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const linkClasses =
    "px-3 py-2 rounded-full text-ink-900 hover:bg-lavender-50 hover:text-lavender-800 transition-colors";

  return (
    <nav className="w-full border-b border-mist-200 bg-white top-0 z-50">
      <div className="px-4 mb-1 sm:px-6 lg:px-8">
        {/* Top Row */}
        <div className="flex h-16 items-center justify-between space-x-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <Image
                src="/campus-vibe-logo.png"
                alt="CampusVibe Logo"
                width={150}
                height={60}
                priority={true}
              />
            </Link>
          </div>

          {/* Search (inline on lg+) */}
          <div className="flex-1 hidden lg:flex">
            <SearchBar className="w-full max-w-3xl" />
          </div>

          {/* Desktop Links */}
          <div className="hidden xl:flex space-x-1 items-center text-sm font-medium whitespace-nowrap">
            <Link href="/events" className={linkClasses}>
              Find events
            </Link>
            <Link href="/clubs" className={linkClasses}>
              Find clubs
            </Link>
            <Link href="/create-event" className={linkClasses}>
              Create event
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className={linkClasses}>Dashboard</Link>
                {user && isClubAdmin(user) && (
                  <Link href="/club-dashboard" className={linkClasses}>My club</Link>
                )}
                {user && isAdmin(user) && (
                  <Link href="/admin" className={linkClasses}>Admin</Link>
                )}
                <Link href="/profile" className={linkClasses}>Profile</Link>
                <button onClick={logout} className={linkClasses}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={linkClasses}>Log in</Link>
                <Button href="/login" className="ml-1">
                  Sign up
                </Button>
              </>
            )}
          </div>

          {/* Mobile Right Side */}
          <div className="flex xl:hidden items-center space-x-1 text-sm font-medium">
            <Link href="/events" className={`${linkClasses} hidden sm:block`}>
              Find events
            </Link>
            {!isAuthenticated && (
              <Link href="/login" className={linkClasses}>
                Log in
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="p-3 rounded-full hover:bg-lavender-50"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search (second row, below lg) */}
        <div className="w-full py-2 lg:hidden">
          <SearchBar />
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="xl:hidden mt-1 space-y-1 mb-3">
            <Link href="/events" className="block px-3 py-2 rounded-xl hover:bg-lavender-50 sm:hidden">
              Find events
            </Link>
            <Link href="/clubs" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
              Find clubs
            </Link>
            <Link href="/create-event" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
              Create event
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
                  Dashboard
                </Link>
                {user && isClubAdmin(user) && (
                  <Link href="/club-dashboard" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
                    My club
                  </Link>
                )}
                {user && isAdmin(user) && (
                  <Link href="/admin" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
                    Admin
                  </Link>
                )}
                <Link href="/profile" className="block px-3 py-2 rounded-xl hover:bg-lavender-50">
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="block w-full text-left px-3 py-2 rounded-xl hover:bg-lavender-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="block px-3 py-2 rounded-xl font-semibold text-lavender-600 hover:bg-lavender-50">
                Sign up
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
