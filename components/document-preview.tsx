'use client';

import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/markdown';

interface DocumentPreviewProps {
    isReadonly: boolean;
    result?: Record<string, unknown>;
    args?: Record<string, unknown>;
}

export function DocumentPreview({
    isReadonly,
    result,
    args,
}: DocumentPreviewProps) {
    const content = (result?.content as string) || (args?.content as string) || 'No content available';
    const title = (result?.title as string) || (args?.title as string) || 'Document';

    return (
        <div className="flex flex-col gap-2 border rounded-md p-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">{title}</h3>
                {!isReadonly && (
                    <Button variant="outline" size="sm">
                        Edit
                    </Button>
                )}
            </div>
            <div className="bg-muted/50 rounded-md p-3">
                <Markdown>{content}</Markdown>
            </div>
        </div>
    );
} 