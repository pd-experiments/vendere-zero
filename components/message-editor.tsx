'use client';

import { ChatRequestOptions, Message } from 'ai';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageEditorProps {
    message: Message;
    setMode: (mode: 'view' | 'edit') => void;
    setMessages: (
        messages: Message[] | ((messages: Message[]) => Message[]),
    ) => void;
    reload: (
        chatRequestOptions?: ChatRequestOptions,
    ) => Promise<string | null | undefined>;
}

export function MessageEditor({
    message,
    setMode,
    setMessages,
    reload,
}: MessageEditorProps) {
    const [content, setContent] = useState(message.content as string);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        setIsSubmitting(true);

        // Update the message in the local state
        setMessages((messages) =>
            messages.map((m) =>
                m.id === message.id ? { ...m, content } : m
            )
        );

        // Exit edit mode
        setMode('view');

        // Optionally reload the conversation with the edited message
        try {
            await reload();
        } catch (error) {
            console.error('Error reloading conversation:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] p-2"
                placeholder="Edit your message..."
            />
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('view')}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSubmitting || !content.trim()}
                >
                    Save
                </Button>
            </div>
        </div>
    );
} 