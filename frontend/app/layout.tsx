import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Figtree, Spline_Sans_Mono } from "next/font/google";
import "@/app/globals.css";
import type { RootLayoutProps } from "@/app/types";
import { GoogleProvider } from "./components/auth-components/GoogleProvider";
import AuthModal from "./components/auth-components/AuthModal";
import AuthModalUrlTrigger from "./components/auth-components/AuthModalUrlTrigger";
import { AuthProvider } from "./lib/auth-context";
import { AuthModalProvider } from "./lib/auth-modal-context";
import { FollowedClubsProvider } from "./lib/followed-clubs-context";
import { ManagedClubsProvider } from "./lib/managed-clubs-context";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CampusVibe",
  description: "Never miss out on your favorite campus events again!"
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta name="keywords" content="campus events, college events, university events, student events, event management, campus activities, student life, event discovery, event planning" />
      </head>

      <body className={`${bricolage.variable} ${figtree.variable} ${splineMono.variable} antialiased min-h-screen flex flex-col`}>
        <GoogleProvider>
          <AuthProvider>
            {/* Mounted once here, so any trigger anywhere can raise the auth
                card without navigating away from the page it interrupted. */}
            <AuthModalProvider>
              {/* Inside AuthProvider because it only fetches once a user is
                  known, and inside AuthModalProvider because a Follow button
                  needs both: the follow state, and the modal to raise when
                  there is no one signed in to follow on behalf of. */}
              <FollowedClubsProvider>
                {/* Which clubs the signed-in user manages. Here rather than in
                    (protected) because the navbar renders on every route and
                    needs it to decide whether to show a Manage link at all. */}
                <ManagedClubsProvider>
                  {children}
                  <AuthModal />
                  {/* Suspense because it reads useSearchParams: without a boundary
                      here, every prerendered route above it would fall back to
                      client-side rendering. It renders nothing, so the fallback
                      is nothing. */}
                  <Suspense fallback={null}>
                    <AuthModalUrlTrigger />
                  </Suspense>
                </ManagedClubsProvider>
              </FollowedClubsProvider>
            </AuthModalProvider>
          </AuthProvider>
        </GoogleProvider>
      </body>
    </html>
  );
}
