import { Club } from "@/app/types";
import ClubCard from "@/app/components/club/ClubCard";

export default function ClubGrid({ clubs }: { clubs: Club[] }) {
    return (
        <div className="grid gap-4 p-2 bg-gray-100 justify-center grid-cols-[repeat(auto-fit,minmax(230px,1fr))] border">
            {clubs.map((club) => (
                <div key={club.id} className="">
                    <ClubCard club={club} />
                </div>
            ))}
        </div>
    );
}