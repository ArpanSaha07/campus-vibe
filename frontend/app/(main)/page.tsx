import BannerCarousel from "@/app/components/BannerCarouselMainPage";
import CategoriesSection from "@/app/components/CategoriesSectionMainPage";
import EventSection from "@/app/components/event/EventSection";
import DiscoverClubs from "@/app/components/DiscoverClubsMainPage";

import { popularEvents } from "@/app/data/data";
import { clubs } from "@/app/data/data";

export default function Home() {
  return (
    <>
      <main>
        <BannerCarousel />
        <CategoriesSection />
        <EventSection title="Popular this weekend" events={popularEvents} />
        <EventSection title="Workshops" events={popularEvents} />
        <EventSection title="Outdoors" events={popularEvents} />
        <DiscoverClubs clubs={clubs} />
      </main>
    </>
  );
}