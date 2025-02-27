'use client';

import { LoaderIcon } from '@/components/icons';

interface WeatherProps {
    weatherAtLocation?: Record<string, unknown>;
}

export function Weather({ weatherAtLocation }: WeatherProps = {}) {
    if (!weatherAtLocation) {
        return (
            <div className="flex flex-col gap-2 border rounded-md p-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium">Weather</h3>
                    <div className="animate-spin">
                        <LoaderIcon size={14} />
                    </div>
                </div>
                <div className="text-sm text-muted-foreground">Loading weather data...</div>
            </div>
        );
    }

    const location = weatherAtLocation.location as string;
    const temperature = weatherAtLocation.temperature as number;
    const condition = weatherAtLocation.condition as string;
    const humidity = weatherAtLocation.humidity as number;
    const windSpeed = weatherAtLocation.windSpeed as number;

    return (
        <div className="flex flex-col gap-2 border rounded-md p-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">Weather in {location}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex flex-col">
                    <span className="text-2xl font-bold">{temperature}°</span>
                    <span className="text-muted-foreground">{condition}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Humidity:</span>
                        <span>{humidity}%</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Wind:</span>
                        <span>{windSpeed} mph</span>
                    </div>
                </div>
            </div>
        </div>
    );
} 