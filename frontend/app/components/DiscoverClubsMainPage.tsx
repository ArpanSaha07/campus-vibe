import Image from "next/image";
import { Club } from "@/app/types";

// TODO: remove followers count for now, should I customise scrollbar for mobile view?

export default function FeaturedOrganizers({ clubs }: { clubs: Club[] }) {
  return (
    <section aria-label="Featured Clubs section on Main Page" className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-row justify-between">
            <h2 className="text-xl font-semibold">Featured Clubs</h2>
            <span><a href="#" className="text-sm text-gray-700 hover:text-indigo-600 hover:underline">See all clubs</a> &nbsp;&gt;</span>
        </div>
      
      <p className="text-gray-500 text-sm mb-6">
        Follow these clubs and get notified when they create new ones.
      </p>

      {/* Scrollable container */}
      <div className="flex space-x-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 p-8 bg-gray-50">
        {clubs
          .filter((club) => club.featured)
          .map((club) => (
            <div
              key={club.id}
              className="flex-shrink-0 w-60 bg-white p-6 rounded-md hover:shadow-lg transition"
            >
              {/* Logo */}
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mx-auto">
                <Image
                  src={club.logo}
                  alt={club.name}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>

              {/* Name + Followers */}
              <div className="text-center mt-4 mb-10">
                <a href="#">
                  <h3 className="font-semibold">{club.name}</h3>
                </a>
                {/* <p className="text-gray-500 text-sm">{club.followers} followers</p> */}
              </div>

              {/* Follow Button */}
              <div className="flex justify-center mt-4">
                <a
                  href="#"
                  className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700 transition"
                >
                  Follow
                </a>
              </div>
            </div>
        ))}
      </div>
    </section>
  );
}