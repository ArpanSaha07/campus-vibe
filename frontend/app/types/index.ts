import type { ReactNode } from "react"

// Data Types
export type EventInstance = {
  eventId: string;
  title: string;
  details: string;
  dateTime: Date;
  createdAt: Date;
  location: { 
    name: string,
    address: string,
    mapUrl: string,
    locationDetails?: string
  };
  price: string;
  organizer: Club["clubId"];
  followers: number;
  images: string[];
  promoted: boolean;
  capacity: number;
  registered: number;
  categories: string[];
  // recurrence?
};

export type Club = {
    clubId: string;
    name: string;
    description: string;
    followers: number;
    logo: string;
    socialLinks: {
      email: string;
      website?: string;
      facebook?: string;
      instagram?: string;
    },
    featured: boolean;
    images: string[];
    createdAt: Date;
    // clubcategories: string[];
};

// Mirrors backend UserDTO (com.campusvibe.user.UserDTO)
export type Role = 'USER' | 'CLUB_ADMIN' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  dateJoined: string; // ISO-8601 instant from the backend
  managedClubId: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Page Types
export type RootLayoutProps = Readonly<{
  children: ReactNode;
}>

export type ClubPageProps = {
  params: Promise<{
    clubId: string;
  }>;
}

export type EventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
}

// Components Types
export type PillProps = {
    children: ReactNode
    className?: string
}

export interface ClubFormData {
  name: string;
  description: string;
  logo: File | null;
  images: File[];
  socialLinks: {
    email: string;
    website: string;
    facebook: string;
    instagram: string;
  };
}

export interface LogoPreviewProps {
  logoPreview: string | null;
  onRemove: () => void;
  onUploadClick: () => void;
  isDisabled?: boolean;
  error?: string;
}

export interface ImageGalleryProps {
  imagePreviews: string[];
  imageCount: number;
  maxImages: number;
  onRemove: (index: number) => void;
  onUploadClick: () => void;
  isDisabled?: boolean;
  error?: string;
}

// Error Types
export interface FormErrors {
  name?: string;
  description?: string;
  logo?: string;
  images?: string;
  social?: string;
  general?: string;
}