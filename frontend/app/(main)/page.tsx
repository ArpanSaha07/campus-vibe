import type { CSSProperties } from "react";
import BannerCarousel from "@/app/components/main-page/BannerCarouselMainPage";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import DiscoverClubs from "@/app/components/main-page/DiscoverClubsMainPage";
import PlannerCard from "@/app/components/main-page/PlannerCardMainPage";

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
      <div className="fade-up" style={reveal(2)}>
        <EventSection title="Popular this weekend" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(3)}>
        <PlannerCard />
      </div>
      <div className="fade-up" style={reveal(4)}>
        <EventSection title="Workshops" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(5)}>
        <EventSection title="Outdoors" events={popularEvents} />
      </div>
      <div className="fade-up" style={reveal(6)}>
        <DiscoverClubs clubs={clubs} />
      </div>
    </main>
  );
}
