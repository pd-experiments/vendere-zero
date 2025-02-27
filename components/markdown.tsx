'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
    children: string;
    className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
    return (
        <ReactMarkdown
            className={cn(
                'prose dark:prose-invert max-w-none',
                '[&>p]:mb-4 [&>p:last-child]:mb-0',
                '[&>ul]:mb-4 [&>ul:last-child]:mb-0',
                '[&>ol]:mb-4 [&>ol:last-child]:mb-0',
                '[&>blockquote]:mb-4 [&>blockquote:last-child]:mb-0',
                '[&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-6 [&>h1]:mb-4',
                '[&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-3',
                '[&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-4 [&>h3]:mb-2',
                '[&>h4]:text-base [&>h4]:font-bold [&>h4]:mt-3 [&>h4]:mb-2',
                '[&>h5]:text-sm [&>h5]:font-bold [&>h5]:mt-3 [&>h5]:mb-1',
                '[&>h6]:text-xs [&>h6]:font-bold [&>h6]:mt-3 [&>h6]:mb-1',
                className
            )}
            remarkPlugins={[remarkGfm]}
        >
            {children}
        </ReactMarkdown>
    );
} 