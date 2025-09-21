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
      img: "/techfair-image.png",
      link: "https://www.mcgill.ca/careers4engineers/techfair/students",
      alt: "Tech Fair 2025",
    },
    {
      img: "/frosh2.jpeg",
      link: "/event/2",
      alt: "Event 2",
    },
    {
      img: "/frosh3.jpeg",
      link: "/event/3",
      alt: "Event 3",
    },
  ];

  return (
    <div aria-label="Banner Section" className="w-full max-w-7xl mx-auto mt-30 lg:mt-20 p-5">
      <Swiper
        spaceBetween={10}
        centeredSlides={true}
        autoplay={{
          delay: 8000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="rounded-xl overflow-hidden"
      >
        {banners.map((banner, index) => (
          <SwiperSlide key={index}>
            <Link href={banner.link} target="_blank" rel="noopener noreferrer">
              <Image
                src={banner.img}
                alt={banner.alt}
                width={1600}
                height={500}
                className="w-full h-[300px] sm:h-[400px] lg:h-[500px] object-cover cursor-pointer"
                priority={index === 0}
              />
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
