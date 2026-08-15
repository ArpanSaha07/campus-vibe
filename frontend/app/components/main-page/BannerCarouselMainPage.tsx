"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import Image from "next/image";
import Link from "next/link";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export default function BannerCarousel() {
  // Example banner data (replace with your own)
  const banners = [
    {
      img: "/rave.jpg",
      link: "/events/sat-2025",
      alt: "Event 2",
    },
    {
      img: "/party.jpg",
      link: "/events/mts-2025",
      alt: "Event 3",
    },
    {
      img: "/techfair-image.png",
      link: "https://www.mcgill.ca/careers4engineers/techfair/students",
      alt: "Tech Fair 2025",
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
            <Link href={banner.link}>
              <Image
                src={banner.img}
                alt={banner.alt}
                width={1600}
                height={500}
                className="w-full h-[300px] lg:h-[400px] object-cover cursor-pointer"
                priority={index === 0}
              />
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
