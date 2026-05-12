import Image from "next/image";
import Link from "next/link";
import { Club } from "@/app/types";

// TODO: remove followers count for now, should I customise scrollbar for mobile view?

export default function ClubProfileComponent({ club }: { club: Club }) {
  return ( 
    <div className="flex-shrink-0 w-60 bg-white p-6 rounded-md hover:shadow-lg transition">
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
        <Link href={`/clubs/${club.id}`}>
          <h3 className="font-semibold">{club.name}</h3>
        </Link>
        {/* <p className="text-gray-500 text-sm">{club.followers} followers</p> */}
      </div>

      {/* Follow Button */}
      <div className="flex justify-center mt-4">
        <Link
          href="#"
          className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700 transition"
        >
          Follow
        </Link>
      </div>
    </div>
  )
}