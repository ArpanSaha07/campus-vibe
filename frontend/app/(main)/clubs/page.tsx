import { Suspense } from "react";
import { Club } from "@/app/types";
import { getAllClubs } from "@/app/lib/club";
import ClubGrid from "@/app/components/club/ClubGrid";

async function ClubsContent() {
    // const clubs: Club[] = await getAllClubs();
    return (
        <section aria-label="Featured Clubs" className="py-10">
            {/* <ClubGrid clubs={clubs} /> */}
        </section>
    );
}

export default function ClubPage() {
    return (
        <div className="w-full mx-auto p-8">
            <h1>Explore all the present clubs.</h1>
            <h2>Find your community and get involved!</h2>
            <h2>If you can't find your club here, then feel free to start your own club page!</h2>
            
            <Suspense fallback={<div>Loading clubs...</div>}>
                <ClubsContent />
            </Suspense>

       </div>
    );
}