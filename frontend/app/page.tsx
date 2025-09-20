import Navbar from "./components/Navbar";
import BannerCarousel from "./components/BannerCarousel";
import CategoriesSection from "./components/CategoriesSection";
import EventsSection from "./components/EventsSectionMainPage";
import DiscoverClubs from "./components/DiscoverClubs";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Navbar />
        <BannerCarousel />
        <CategoriesSection />
        <EventsSection />
        <DiscoverClubs />
      </main>

      <Footer />
    </>
  );
}