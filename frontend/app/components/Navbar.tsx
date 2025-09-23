"use client";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// notes: fix spacing of items in desktop view; work on search functionality

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <div className="group relative w-full max-w-3xl">
              <input
                type="text"
                placeholder="Search events"
                className="w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black group-hover:shadow-md transition-all"
              />
              <button className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-orange-600 group-hover:shadow-md transition-all">
                <Search className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex space-x-2 items-center text-sm font-medium whitespace-nowrap">
            <Link href="/events" className="p-3 rounded-full hover:bg-gray-100">
              Find Events
            </Link>
            <Link href="/create" className="p-3 rounded-full hover:bg-gray-100">
              Create Events
            </Link>
            <Link href="/my-events" className="p-3 rounded-full hover:bg-gray-100">
              My Events
            </Link>
            <Link href="/login" className="p-3 rounded-full hover:bg-gray-100">
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1 font-bold border-2 rounded-2xl border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white transition"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Right Side (Few items + Hamburger) */}
          <div className="flex md:hidden items-center space-x-2 text-sm font-medium">
            <Link href="/events" className="p-3 rounded-full hover:bg-gray-100">
              Find events
            </Link>
            <Link href="/login" className="p-3 rounded-full hover:bg-gray-100">
              Log In
            </Link>
            <Link href="/signup" className="p-3 rounded-full hover:bg-gray-100">
              Sign Up
            </Link>
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
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search events"
              className="w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black"
            />
            <button className="absolute right-1 flex items-center justify-center h-8 w-8 rounded-full bg-orange-600">
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden mt-1 space-y-2 mb-2">
            <Link href="/create" className="block p-2 hover:text-orange-600 hover:bg-gray-100">
              Create Events
            </Link>
            <Link href="/my-events" className="block p-2 hover:text-orange-600 hover:bg-gray-100">
              My Events
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}