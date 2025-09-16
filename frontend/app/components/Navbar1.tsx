// // components/Navbar.tsx
// import { Search } from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";

// export default function Navbar() {
//   return (
//     <nav className="w-full border-b border-gray-200 bg-white">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="flex h-16 items-center justify-between">
//           {/* Left: Logo */}
//           <div className="flex-shrink-0 flex items-center">
//             <Link href="/">
//               <Image
//                 src="/campus-vibe-logo.png" // replace with your logo
//                 alt="Logo"
//                 width={150}
//                 height={60}
//                 priority
//               />
//             </Link>
//           </div>

//           {/* Middle: Search Bar */}
//           <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-center">
//             <div className="w-full max-w-lg lg:max-w-xs">
//               <label htmlFor="search" className="sr-only">
//                 Search
//               </label>
//               <div className="relative">
//                 <input
//                   id="search"
//                   name="search"
//                   className="block w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black"
//                   placeholder="Search events"
//                   type="search"
//                 />
//                 <div className="absolute inset-y-0 right-0 flex items-center p-1 pointer-events-none bg-purple-500 rounded-full h-7 w-7">
//                   <Search className="h-5 w-5 text-white" />
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Right: Nav Links */}
//           <div className="flex space-x-6 items-center text-sm font-medium">
//             <Link href="/find-events" className="hover:text-purple-700">
//               Find Events
//             </Link>
//             <Link href="/create" className="hover:text-purple-700">
//               Create Events
//             </Link>
//             <Link href="/my-events" className="hover:text-purple-700">
//               My Events
//             </Link>
//             <Link href="/login" className="hover:text-purple-700">
//               Log In
//             </Link>
//             <Link
//               href="/signup"
//               className="px-3 py-1 border rounded-full border-purple-700 text-purple-700 hover:bg-purple-700 hover:text-white transition"
//             >
//               Sign Up
//             </Link>
//           </div>
//         </div>
//       </div>
//     </nav>
//   );
// }

// components/Navbar.tsx
"use client";

import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Row */}
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <Image
                src="/campus-vibe-logo.png" // replace with your logo
                alt="Logo"
                width={150}
                height={60}
                priority={true}
              />
            </Link>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex space-x-2 items-center text-sm font-medium">
            <Link href="/find-events" className="hover:bg-gray-100 px-3 py-3 rounded-full">
              Find Events
            </Link>
            <Link href="/create" className="hover:bg-gray-100 px-3 py-3 rounded-full">
              Create Events
            </Link>
            <Link href="/my-events" className="hover:bg-gray-100 px-3 py-3 rounded-full">
              My Events
            </Link>
            <Link href="/login" className="hover:bg-gray-100 px-3 py-3 rounded-full">
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1 border rounded-full border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white transition"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Right Side (Some links + Hamburger) */}
          <div className="flex md:hidden items-center space-x-4 text-sm font-medium">
            <Link href="/tickets" className="hover:text-purple-600">
              Find my tickets
            </Link>
            <Link href="/login" className="hover:text-purple-600">
              Log In
            </Link>
            <Link href="/signup" className="hover:text-purple-600">
              Sign Up
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search bar (always below on mobile, inline on larger)
        <div className="w-full py-2 md:hidden">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search events"
              className="w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black"
            />
            <button className="absolute right-1 flex items-center justify-center h-8 w-8 rounded-full bg-purple-600">
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>
        </div> */}

        {/* Middle: Search Bar */}
           <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-center">
             <div className="w-full max-w-lg lg:max-w-xs">
               <label htmlFor="search" className="sr-only">
                 Search
              </label>
               <div className="relative">
                 <input
                  id="search"
                  name="search"
                  className="block w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black"
                  placeholder="Search events"
                  type="search"
                />
                <div className="absolute inset-y-0 right-0 flex items-center p-1 pointer-events-none bg-purple-500 rounded-full h-7 w-7">
                  <Search className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          </div>



        {/* Mobile Menu (Dropdown) */}
        {menuOpen && (
          <div className="md:hidden mt-2 space-y-2 pb-4">
            <Link href="/find-events" className="block hover:text-purple-600">
              Find Events
            </Link>
            <Link href="/create" className="block hover:text-purple-600">
              Create Events
            </Link>
            <Link href="/my-events" className="block hover:text-purple-600">
              My Events
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

