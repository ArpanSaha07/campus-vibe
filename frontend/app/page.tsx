import BannerCarousel from "./components/BannerCarousel";
import CategoriesSection from "./components/CategoriesSectionMainPage";
import EventSection from "./components/events/EventSection";
import DiscoverClubs from "./components/DiscoverClubs";

import { popularEvents } from "@/app/data/data";
import { clubs } from "@/app/data/data";

export default function Home() {
  return (
    <>
      <main>
        <BannerCarousel />
        <CategoriesSection />
        <EventSection title="Popular this weekend" events={popularEvents} />
        <EventSection title="Career Fairs" events={popularEvents} />
        <EventSection title="Workshops" events={popularEvents} />
        <EventSection title="Outdoors" events={popularEvents} />
        <DiscoverClubs clubs={clubs} />
      </main>
    </>
  );
}