import Navbar from "./components/Navbar";
import BannerCarousel from "./components/BannerCarousel";
import CategoriesSection from "./components/CategoriesSection";
import EventsSection from "./components/EventsSection";

export default function Home() {
  return (
    <>
      <main>
        <Navbar />
        <BannerCarousel />
        <CategoriesSection />
        <EventsSection />

        {/* Banner, hero section, etc. will go here */}
      </main>
      <footer className="">
        
      </footer>
    </>
  );
}