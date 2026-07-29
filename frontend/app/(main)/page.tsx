import type { CSSProperties } from "react";
import BannerCarousel from "@/app/components/main-page/BannerCarouselMainPage";
import CategoriesSection from "@/app/components/main-page/CategoriesSectionMainPage";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import DiscoverClubs from "@/app/components/main-page/DiscoverClubsMainPage";

import { popularEvents } from "@/app/data/data";
import { clubs } from "@/app/data/data";

function reveal(index: number): CSSProperties {
  return { "--reveal-index": index } as CSSProperties;
}

export default function Home() {
  return (
    <main>
      <div className="fade-up" style={reveal(0)}>
        <BannerCarousel />
      </div>
      <div className="fade-up" style={reveal(1)}>
        <CategoriesSection />
      </div>
      <div className="fade-up" style={reveal(2)}>
        <EventSection title="Popular this weekend" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(3)}>
        <EventSection title="Workshops" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(4)}>
        <EventSection title="Outdoors" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(5)}>
        <DiscoverClubs clubs={clubs} />
      </div>
    </main>
  );
}
