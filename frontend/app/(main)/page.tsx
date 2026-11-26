import { Suspense, type CSSProperties } from "react";
import BannerCarousel from "@/app/components/main-page/BannerCarouselMainPage";
import CategoriesSection from "@/app/components/main-page/CategoriesSectionMainPage";
import DiscoverClubs from "@/app/components/main-page/DiscoverClubsMainPage";
import PlannerCard from "@/app/components/main-page/PlannerCardMainPage";
import LiveEventSection from "@/app/components/main-page/LiveEventSection";

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
        <Suspense fallback={null}>
          <LiveEventSection row="popular" />
        </Suspense>
      </div>
      <div className="fade-up" style={reveal(3)}>
        <PlannerCard />
      </div>
      <div className="fade-up" style={reveal(1)}>
        <CategoriesSection />
      </div>
      <div className="fade-up" style={reveal(4)}>
        <Suspense fallback={null}>
          <LiveEventSection row="workshops" />
        </Suspense>
      </div>
      <div className="fade-up" style={reveal(5)}>
        <Suspense fallback={null}>
          <LiveEventSection row="personal" />
        </Suspense>
      </div>
      <div className="fade-up" style={reveal(6)}>
        {/* Fetches live clubs itself; no fallback, since it renders nothing
            when there is nothing to feature. */}
        <Suspense fallback={null}>
          <DiscoverClubs />
        </Suspense>
      </div>
    </main>
  );
}
