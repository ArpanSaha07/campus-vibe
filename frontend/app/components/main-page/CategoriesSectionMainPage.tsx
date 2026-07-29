import Link from "next/link";
import { Music, Disc3, Calendar, Heart, Gamepad, Briefcase, Pizza, Drama } from "lucide-react";

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

function CategoryLink({
  name,
  Icon,
  circle,
  iconSize,
  labelSize,
}: {
  name: string;
  Icon: typeof Music;
  circle: string;
  iconSize: string;
  labelSize: string;
}) {
  return (
    <Link
      href={`/events?q=${encodeURIComponent(name)}`}
      className="flex flex-col items-center group cursor-pointer"
    >
      <div
        className={`flex items-center justify-center ${circle} rounded-full bg-lavender-50 text-lavender-800
          group-hover:bg-lavender-600 group-hover:text-white transition-colors duration-150`}
      >
        <Icon className={iconSize} />
      </div>
      <span
        className={`mt-2 ${labelSize} font-medium text-ink-600 group-hover:text-lavender-800 transition-colors text-center`}
      >
        {name}
      </span>
    </Link>
  );
}

export default function CategoriesSection() {
  return (
    <section aria-label="Browse by category" className="max-w-7xl mx-auto py-8 px-3">
      {/* Desktop: horizontal scroll */}
      <div className="hidden sm:flex space-x-8 overflow-x-auto gap-6 justify-items-center">
        {categories.map(({ name, icon: Icon }) => (
          <div key={name} className="min-w-[100px]">
            <CategoryLink name={name} Icon={Icon} circle="w-25 h-25" iconSize="h-10 w-10" labelSize="text-sm" />
          </div>
        ))}
      </div>

      {/* Mobile: grid layout */}
      <div className="grid grid-cols-4 gap-4 sm:hidden">
        {categories.map(({ name, icon: Icon }) => (
          <CategoryLink
            key={name}
            name={name}
            Icon={Icon}
            circle="w-18 h-18"
            iconSize="h-6 w-6"
            labelSize="text-xs"
          />
        ))}
      </div>
    </section>
  );
}
