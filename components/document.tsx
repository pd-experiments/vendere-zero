'use client';

import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/markdown';

interface DocumentToolCallProps {
    type: 'update' | 'request-suggestions';
    args: Record<string, unknown>;
    isReadonly: boolean;
}

export function DocumentToolCall({
    type,
    args,
}: DocumentToolCallProps) {
    return (
        <div className="flex flex-col gap-2 border rounded-md p-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">
                    {type === 'update' ? 'Document Update' : 'Requesting Suggestions'}
                </h3>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
                <Markdown>{(args?.content as string) || 'Processing...'}</Markdown>
            </div>
        </div>
    );
}

interface DocumentToolResultProps {
    type: 'update' | 'request-suggestions';
    result: Record<string, unknown>;
    isReadonly: boolean;
}

export function DocumentToolResult({
    type,
    result,
    isReadonly,
}: DocumentToolResultProps) {
    return (
        <div className="flex flex-col gap-2 border rounded-md p-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">
                    {type === 'update' ? 'Document Updated' : 'Suggestions'}
                </h3>
                {!isReadonly && type === 'request-suggestions' && (
                    <Button variant="outline" size="sm">
                        Apply
                    </Button>
                )}
            </div>
            <div className="bg-muted/50 rounded-md p-3">
                <Markdown>{(result?.content as string) || 'No content available'}</Markdown>
            </div>
        </div>
    );
} 