import { Club } from "@/app/types";
import { getAllClubs } from "@/app/lib/club";
import ClubGrid from "@/app/components/club/ClubGrid";

export default function ClubPage() {
    const clubs: Club[] = getAllClubs();
    return (
        <div className="w-full mx-auto p-4 bg-blue-500">
            <h1>Explore all the present clubs.</h1>
            <h2>Find your community and get involved!</h2>
            <h2>If you can't find your club here, then feel free to start your own club page!</h2>
            
            <section aria-label="Featured Clubs" className="py-10 border">
                <ClubGrid clubs={clubs} />
            </section>

       </div>
    );
}