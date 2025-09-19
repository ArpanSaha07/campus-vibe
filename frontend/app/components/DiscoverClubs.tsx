import Image from "next/image";

const organizers = [
  {
    id: 1,
    name: "Fashion Takes Action",
    followers: 137,
    logo: "/logos/fta.png",
  },
  {
    id: 2,
    name: "RIB ENTERTAINMENT",
    followers: 380,
    logo: "/logos/rib.png",
  },
  {
    id: 3,
    name: "Making Waves Montreal",
    followers: 174,
    logo: "/logos/mwm.png",
  },
  {
    id: 4,
    name: "PersianEvents",
    followers: 128,
    logo: "/logos/persian.png",
  },
  {
    id: 5,
    name: "Glimmering Dolls",
    followers: 341,
    logo: "/logos/dolls.png",
  },
];

// remove followers count for now

export default function FeaturedOrganizers() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-row justify-between">
            <h2 className="text-xl font-semibold">Featured Clubs</h2>
            <span><a href="#" className="text-sm text-gray-700 hover:text-indigo-600 hover:underline">See all clubs</a> &nbsp;&gt;</span>
        </div>
      
      <p className="text-gray-500 text-sm mb-6">
        Follow these clubs and get notified when they create new ones.
      </p>

      {/* Scrollable container */}
      <div className="flex space-x-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 pb-2 bg-gray-50">
        {organizers.map((org) => (
          <div
            key={org.id}
            className="flex-shrink-0 w-60 bg-white p-6 rounded-md hover:shadow-lg transition"
          >
            {/* Logo */}
            <a href="#" className="flex justify-center">
              <Image
                src={org.logo}
                alt={org.name}
                width={80}
                height={80}
                className="rounded-full"
              />
            </a>

            {/* Name + Followers */}
            <div className="text-center mt-4 mb-10">
              <a href="#">
                <h3 className="font-semibold">{org.name}</h3>
              </a>
              {/* <p className="text-gray-500 text-sm">{org.followers} followers</p> */}
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