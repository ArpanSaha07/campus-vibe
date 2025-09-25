import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { RootLayoutProps } from "@/app/types";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { GoogleProvider } from "./components/auth-components/GoogleProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase: new URL(""),
  title: "CampusVibe",
  description: "Never miss out on your favorite campus events again!"
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta name="keywords" content="campus events, college events, university events, student events, event management, campus activities, student life, event discovery, event planning" />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <GoogleProvider>
          <Navbar />
          <div className="flex-1 flex flex-col"> {/* Allows the main content area to grow and fill the available space between the navbar and footer */}
            {children}
          </div>
          <Footer />
        </GoogleProvider>
      </body>
    </html>
  );
}
