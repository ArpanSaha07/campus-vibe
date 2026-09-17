"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import Image from "next/image";
import Link from "next/link";
import BannerShadow from "./BannerShadow";
import BannerTextOverlay from "./BannerTextOverlay";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export default function BannerCarousel() {
  // Example banner data (replace with your own)
  const banners = [
    {
      img: "/mcgill-find-clubs.jpg",
      link: "https://ssmu.ca/student-life/activities-night/",
      alt: "Activities Night",
      eyebrow: "Find your people in",
      title: "Activities Night",
      description:
        "From debate to dragon boating, there is a club for whatever you are into. Browse and follow the clubs you like on our platform and never miss what they host.",
    },
    {
      img: "/tech-fair.png",
      link: "https://www.mcgill.ca/careers4engineers/techfair/students",
      alt: "Tech Fair 2026",
      eyebrow: "Supercharge your career at",
      title: "Tech Fair 2026",
      description:
        "Looking for a job or internship? Meet top employers and network with industry professionals. Sept 30 and Oct 1. Click here for more info.",
    },
    {
      img: "/birds.jpeg",
      link: "https://www.facebook.com/events/george-%C3%A9tienne-cartier-monument/bird-walk-at-mcgill-biodiversityfestival/1746273696674952/",
      alt: "Event 2",
      eyebrow: "Join us for a Bird Walk",
      title: "at McGill Biodiversity Festival",
      description:
        "The McGill Students' Birding Club is offering a guided birdwatching walk on Mont-Royal the morning of on Tuesday September 22. Click here to view details.",
    },
    {
      img: "/party.jpg",
      link: "/events",
      alt: "All events",
      eyebrow: "Plans for",
      title: "This weekend",
      description:
        "Parties, shows and late nights around campus and downtown. See what is on, bookmark what you like and add it straight to your calendar.",
    }
  ];

  return (
    <div aria-label="Banner Section" className="w-full max-w-7xl mx-auto pb-5 sm:px-5 sm:pt-5">
      <Swiper
        spaceBetween={10}
        centeredSlides={true}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="sm:rounded-xl overflow-hidden"
      >
        {banners.map((banner, index) => (
          <SwiperSlide key={index}>
            <Link href={banner.link} className="relative block">
              <Image
                src={banner.img}
                alt={banner.alt}
                width={1600}
                height={500}
                className="w-full h-[300px] lg:h-[400px] object-cover cursor-pointer"
                priority={index === 0}
              />
              <BannerShadow />
              <BannerTextOverlay
                eyebrow={banner.eyebrow}
                title={banner.title}
                description={banner.description}
              />
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
