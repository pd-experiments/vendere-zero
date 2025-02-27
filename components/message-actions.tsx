'use client';

import { Message } from 'ai';
import { memo } from 'react';
import { Button } from './ui/button';
import { ThumbsDownIcon, ThumbsUpIcon } from '@/components/icons';
import equal from 'fast-deep-equal';

export interface Vote {
    id: string;
    messageId: string;
    type: 'up' | 'down';
    createdAt: Date;
  } 
  
interface MessageActionsProps {
    chatId: string;
    message: Message;
    vote: Vote | undefined;
    isLoading: boolean;
}

function PureMessageActions({
    chatId,
    message,
    vote,
    isLoading,
}: MessageActionsProps) {
    // Only show actions for assistant messages
    if (message.role !== 'assistant') {
        return null;
    }

    const handleVote = async (type: 'up' | 'down') => {
        // In a real implementation, this would send the vote to the server
        console.log(`Voted ${type} for message ${message.id} in chat ${chatId}`);
    };

    return (
        <div className="flex items-center gap-2 self-end">
            <div className="flex items-center">
                <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-8 w-8"
                    disabled={isLoading || vote?.type === 'up'}
                    onClick={() => handleVote('up')}
                >
                    <ThumbsUpIcon
                        size={14}
                        className={vote?.type === 'up' ? 'text-green-500' : ''}
                    />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-8 w-8"
                    disabled={isLoading || vote?.type === 'down'}
                    onClick={() => handleVote('down')}
                >
                    <ThumbsDownIcon
                        size={14}
                        className={vote?.type === 'down' ? 'text-red-500' : ''}
                    />
                </Button>
            </div>
        </div>
    );
}

export const MessageActions = memo(
    PureMessageActions,
    (prevProps, nextProps) => {
        if (prevProps.isLoading !== nextProps.isLoading) return false;
        if (!equal(prevProps.vote, nextProps.vote)) return false;
        return true;
    }
); 