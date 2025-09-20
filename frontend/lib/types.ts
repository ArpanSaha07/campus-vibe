

export type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  price: string;
  organizer: string;
  followers: number;
  image: string;
  promoted: boolean;
  capacity: number;
  registered: number;
  dateTime: string;
};

export type Club = {
    id: number;
    name: string;
    description: string;
    followers: number;
    logo: string;
    banner: string;
    website: string;
    email: string;
    socialLinks: {
        facebook: string;
        instagram: string;
    },
    featured: boolean;
};
