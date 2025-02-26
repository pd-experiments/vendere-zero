'use client';

import { usePathname } from 'next/navigation';
import { SearchContainer } from './search-container';

interface ConditionalSearchProps {
    session: boolean;
}

export function ConditionalSearch({ session }: ConditionalSearchProps) {
    const pathname = usePathname();
    const isLibraryRoute = pathname === '/library';

    if (!session || !isLibraryRoute) {
        return null;
    }

    return <SearchContainer />;
} 