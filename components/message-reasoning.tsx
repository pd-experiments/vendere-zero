'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ChevronUpIcon, LoaderIcon } from '@/components/icons';
import { Markdown } from '@/components/markdown';

interface MessageReasoningProps {
    reasoning: string;
    isLoading: boolean;
}

export function MessageReasoning({
    reasoning,
    isLoading,
}: MessageReasoningProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="flex flex-col gap-2 w-full">
            <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 self-start text-xs text-muted-foreground"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isLoading ? (
                    <LoaderIcon className="animate-spin" size={12} />
                ) : isExpanded ? (
                    <ChevronUpIcon size={12} />
                ) : (
                    <ChevronDownIcon size={12} />
                )}
                {isExpanded ? 'Hide reasoning' : 'Show reasoning'}
            </Button>

            {isExpanded && (
                <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                    <Markdown>{reasoning}</Markdown>
                </div>
            )}
        </div>
    );
} 