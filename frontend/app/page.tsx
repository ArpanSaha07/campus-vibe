import Navbar from "./components/Navbar";
import BannerCarousel from "./components/BannerCarousel";
import CategoriesSection from "./components/CategoriesSectionMainPage";
import EventSection from "./components/events/EventSection";
import DiscoverClubs from "./components/DiscoverClubs";
import Footer from "./components/Footer";

import { popularEvents } from "@/lib/data";

export default function Home() {
  return (
    <>
      <main>
        <Navbar />
        <BannerCarousel />
        <CategoriesSection />
        <EventSection title="Popular this weekend" events={popularEvents} />
        <EventSection title="Career Fairs" events={popularEvents} />
        <EventSection title="Workshops" events={popularEvents} />
        <EventSection title="Outdoors" events={popularEvents} />
        <DiscoverClubs />
      </main>

      <Footer />
    </>
  );
}