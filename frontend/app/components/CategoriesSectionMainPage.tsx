// import { Music, Glasses, Calendar, Heart, Gamepad, Briefcase, Pizza } from "lucide-react";

// const categories = [
//   { name: "Music", icon: Music },
//   { name: "Nightlife", icon: Glasses },
//   { name: "Holidays", icon: Calendar },
//   { name: "Dating", icon: Heart },
//   { name: "Hobbies", icon: Gamepad },
//   { name: "Business", icon: Briefcase },
//   { name: "Food & Drink", icon: Pizza },
//   { name: "More", icon: Calendar }
// ];

// export default function CategoriesSection() {
//   return (
//     <section className="max-w-7xl mx-auto py-10">
//       <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-8 justify-items-center">
//         {categories.map(({ name, icon: Icon }) => (
//           <div
//             key={name}
//             className="flex flex-col items-center group cursor-pointer"
//           >
//             {/* Circle with icon */}
//             <div className="flex items-center justify-center w-20 h-20 rounded-full border border-gray-300 text-gray-700 group-hover:bg-gray-200 transition">
//               <Icon className="h-7 w-7" />
//             </div>
//             {/* Label */}
//             <span className="mt-2 text-sm font-medium text-gray-700 group-hover:text-blue-600 transition">
//               {name}
//             </span>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }

import { Music, Disc3, Calendar, Heart, Gamepad, Briefcase, Pizza, Drama} from "lucide-react";

const categories = [
  { name: "Music", icon: Music },
  { name: "Nightlife", icon: Disc3 },
  { name: "Holidays", icon: Calendar },
  { name: "Dating", icon: Heart },
  { name: "Hobbies", icon: Gamepad },
  { name: "Business", icon: Briefcase },
  { name: "Food & Drink", icon: Pizza },
  { name: "Performing & Visual Arts", icon: Drama },
];

export default function CategoriesSection() {
  return (
    <section className="max-w-7xl mx-auto py-8 px-3">
      {/* Desktop: horizontal scroll */}
      <div className="hidden sm:flex space-x-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent gap-6 justify-items-center">
        {categories.map(({ name, icon: Icon }) => (
          <div
            key={name}
            className="flex flex-col items-center group cursor-pointer min-w-[100px]"   // ** might need to remove min-w ** //
          >
            {/* Circle */}
            <div className="flex items-center justify-center w-20 h-20 rounded-full border border-gray-300 text-gray-700 group-hover:bg-gray-200 transition">
              <Icon className="h-7 w-7" />
            </div>
            {/* Label */}
            <span className="mt-2 text-sm font-medium text-gray-700 group-hover:text-blue-600 transition text-center">
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: grid layout */}
      <div className="grid grid-cols-4 gap-4 sm:hidden">
        {categories.map(({ name, icon: Icon }) => (
          <div
            key={name}
            className="flex flex-col items-center group cursor-pointer"
          >
            {/* Smaller circle */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gray-300 text-gray-700 group-hover:bg-gray-200 transition">
              <Icon className="h-6 w-6" />
            </div>
            {/* Smaller text */}
            <span className="mt-1 text-xs font-medium text-gray-700 group-hover:text-blue-600 transition text-center">
              {name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

