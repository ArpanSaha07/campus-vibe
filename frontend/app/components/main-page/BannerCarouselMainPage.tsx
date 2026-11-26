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
  // `link` is left empty until each event has a page to point at; an empty
  // link renders the slide without an anchor rather than linking to itself.
  const banners = [
    {
      img: "/claude-workshop.webp",
      link: "",
      alt: "Build AI agents workshop with Mark Pyvovarov",
      eyebrow: "Learn how to build",
      title: "Your own Jarvis",
      description:
        "Build AI agents with guest speaker Mark Pyvovarov in this Claude Builder Club Workshop, and see what our community has been building lately.",
    },
    {
      img: "/gdg.webp",
      link: "",
      alt: "Building AI Voice Agents, a DevPro x GDG McGill workshop",
      eyebrow: "DevPro x GDG McGill",
      title: "Building AI Voice Agents",
      description:
        "Learn to design and build interactive AI voice agents, with live code examples from the DevPro team.",
    },
    {
      img: "/hackathon.jpg",
      link: "",
      alt: "McHacks 14 hackathon",
      eyebrow: "Coder applications are open for",
      title: "McHacks 14",
      description:
        "Don't miss your chance to team up and build something exciting (please, not another Jarvis). Hackathon on Jan 16-17.",
    },
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
        {banners.map((banner, index) => {
          const content = (
            <>
              <Image
                src={banner.img}
                alt={banner.alt}
                width={1600}
                height={500}
                className={`w-full h-[300px] lg:h-[400px] object-cover${banner.link ? " cursor-pointer" : ""}`}
                priority={index === 0}
              />
              <BannerShadow />
              <BannerTextOverlay
                eyebrow={banner.eyebrow}
                title={banner.title}
                description={banner.description}
              />
            </>
          );
          return (
            <SwiperSlide key={index}>
              {banner.link ? (
                <Link href={banner.link} className="relative block">
                  {content}
                </Link>
              ) : (
                <div className="relative block">{content}</div>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
