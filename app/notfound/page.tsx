"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFoundPage() {
    const router = useRouter();

    return (
        <div className="h-full bg-background flex items-center justify-center p-4 no-scrollbar">
            <div className="text-center space-y-4 max-w-md items-center">
                <h1 className="text-4xl font-bold">Uh oh!</h1>
                <h2 className="text-2xl font-semibold">
                    Page Not Found
                </h2>
                <p className="text-muted-foreground">
                    The page you&apos;re looking for doesn&apos;t exist or you lack permission to view it.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                    <Button
                        onClick={() => router.push('/library')}
                        className="flex items-center gap-2"
                    >
                        <Home className="h-4 w-4" />
                        Go to Library
                    </Button>
                </div>
            </div>
        </div>
    );
} 