'use client';

import { useState } from 'react';
import { MultimodalInput } from '@/components/multimodal-input';
import { Attachment, Message, CreateMessage, ChatRequestOptions } from 'ai';
import { Messages } from '@/components/messages';
import { Source } from '@/components/message-sources';

// Extend ChatRequestOptions to include detailLevel
interface CustomChatRequestOptions extends ChatRequestOptions {
    detailLevel?: number;
}

export default function QueryPage() {
    const [messages, setMessages] = useState<Array<Message>>([]);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [detailLevel, setDetailLevel] = useState(50);
    const [deepResearch, setDeepResearch] = useState(false);

    const handleSubmit = async (event?: { preventDefault?: () => void }, options?: CustomChatRequestOptions) => {
        event?.preventDefault?.();

        if (!input.trim()) {
            return;
        }

        setIsLoading(true);
        setHasError(false);

        try {
            // Add user message
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: input,
                createdAt: new Date()
            };
            setMessages(prev => [...prev, userMessage]);
            setInput('');

            // Make API call
            const response = await fetch('/api/knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: input,
                    messages: messages,
                    detailLevel: options?.detailLevel !== undefined ? options.detailLevel : detailLevel,
                    deepResearch: deepResearch,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            if (!data || !data.content) {
                throw new Error('Invalid response format');
            }

            // Include sources and citations in the message if available
            const assistantMessage: Message = {
                id: data.id || Date.now().toString(),
                role: 'assistant',
                content: data.content,
                createdAt: new Date(data.createdAt) || new Date(),
                sources: data.sources as Source[],
                citations: data.citations || [],
                suggestedTasks: data.suggestedTasks || []
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error in chat:', error);
            setHasError(true);
            const errorMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Sorry, there was an error processing your request. Please try again.',
                createdAt: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const reload = async (chatRequestOptions?: CustomChatRequestOptions) => {
        return null;
    };

    const append = async (
        message: Message | CreateMessage,
        chatRequestOptions?: CustomChatRequestOptions
    ) => {
        try {
            // Add user message to the chat
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: message.content,
                createdAt: new Date()
            };
            setMessages(prev => [...prev, userMessage]);

            setIsLoading(true);
            setHasError(false);

            // Make API call
            const response = await fetch('/api/knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: message.content,
                    messages: messages,
                    detailLevel: chatRequestOptions?.detailLevel !== undefined ? chatRequestOptions.detailLevel : detailLevel,
                    deepResearch: deepResearch,
                }),
            });

            if (response.status !== 200) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            // Include sources and citations in the message if available
            const assistantMessage: Message = {
                id: data.id || Date.now().toString(),
                role: 'assistant',
                content: data.content,
                createdAt: new Date(data.createdAt) || new Date(),
                sources: data.sources as Source[],
                citations: data.citations || [],
                suggestedTasks: data.suggestedTasks || []
            };

            setMessages(prev => [...prev, assistantMessage]);
            return message.id;
        } catch (error) {
            console.error('Error in chat:', error);
            setHasError(true);
            const errorMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Sorry, there was an error processing your request. Please try again.',
                createdAt: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden no-scrollbar">
            <div className="flex flex-col flex-1 mx-auto w-full h-full">
                <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0">
                        <Messages
                            isLoading={isLoading}
                            messages={messages}
                            setMessages={setMessages}
                            reload={reload}
                            isReadonly={false}
                            isArtifactVisible={false}
                        />
                    </div>
                </div>

                <div className="bg-background z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
                    <MultimodalInput
                        input={input}
                        setInput={setInput}
                        isLoading={isLoading}
                        stop={() => { }}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        messages={messages}
                        setMessages={setMessages}
                        append={append}
                        handleSubmit={handleSubmit}
                        className="w-full"
                        detailLevel={detailLevel}
                        setDetailLevel={setDetailLevel}
                        deepResearch={deepResearch}
                        setDeepResearch={setDeepResearch}
                    />
                </div>
            </div>
        </div>
    );
}
