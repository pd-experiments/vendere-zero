import { redirect } from "next/navigation";

export default function CatchAllPage({ params }: { params: { missing: string[] } }) {
    // Valid routes and their allowed sub-paths
    const validRoutes = {
        'library': true,
        'market': true,
        'query': true
    };

    // Get the first part of the path
    const mainPath = params.missing[0];

    // If the main path is one of our valid routes, don't redirect
    if (validRoutes[mainPath as keyof typeof validRoutes]) {
        return null; // Let Next.js continue with normal routing
    }

    // Otherwise redirect to notfound
    redirect("/notfound");
} 