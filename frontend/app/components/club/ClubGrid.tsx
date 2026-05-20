import { Club } from "@/app/types";
import ClubCard from "@/app/components/club/ClubCard";

export default function ClubGrid({ clubs }: { clubs: Club[] }) {
    return (
        <div className="grid gap-4 p-2 justify-center grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
            {clubs.map((club) => (
                <div key={club.clubId} className="">
                    <ClubCard club={club} />
                </div>
            ))}
        </div>
    );
}