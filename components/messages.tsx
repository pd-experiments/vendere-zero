import { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from '@/components/message';
import { useScrollToBottom } from '@/components/use-scroll-to-bottom';
import { memo, useState } from 'react';
import equal from 'fast-deep-equal';
import Image from 'next/image';
import { Source } from '@/components/message-sources';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MessagesProps {
  isLoading: boolean;
  messages: Array<Message>;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function ImageGrid({ sources, citations }: { sources: Source[], citations?: string[] }) {
  // Extract image URLs from sources
  const imageUrls = sources
    .map(source => source.extra_info.image_url)
    .filter((url): url is string => !!url);

  // We don't include citation images here since they don't have preview images
  // This could be expanded in the future if needed

  if (imageUrls.length === 0) return null;

  return (
    <motion.div
      className="w-[200px] grid grid-cols-2 gap-2 bg-background/30 p-2 rounded-none border border-border/30"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {imageUrls.map((url, index) => (
        <motion.div
          key={index}
          className="aspect-square relative rounded-none overflow-hidden border border-border/20 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Image
            src={url}
            alt="Source image"
            fill
            className="object-cover transition-transform duration-200 hover:scale-110"
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

function MessageWithImages({ message, isLoading, setMessages, reload, isReadonly }: {
  message: Message;
  isLoading: boolean;
  setMessages: MessagesProps['setMessages'];
  reload: MessagesProps['reload'];
  isReadonly: boolean;
}) {
  const hasVisualContent =
    message.role === 'assistant' &&
    ((message.sources && message.sources.length > 0) ||
      (message.citations && message.citations.length > 0));

  return (
    <div className="flex items-start justify-center w-full">
      <div className="w-[800px] relative">
        <div className={cn(
          "flex items-start gap-8",
          message.role === 'assistant' ? 'pl-0' : '-ml-8'
        )}>
          <div className="flex-grow">
            <PreviewMessage
              message={message}
              isLoading={isLoading}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
            />
          </div>
          {hasVisualContent && (
            <div className="flex-shrink-0">
              <ImageGrid
                sources={message.sources || []}
                citations={message.citations}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PureMessages({
  isLoading,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col gap-6 h-full overflow-y-auto py-4 px-4 no-scrollbar"
    >
      {messages.map((message, index) => (
        <MessageWithImages
          key={message.id}
          message={message}
          isLoading={isLoading && messages.length - 1 === index}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
        />
      ))}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && (
          <div className="flex items-start justify-center w-full">
            <div className="w-[800px] relative">
              <div className="flex items-start gap-8 pl-0">
                <div className="flex-grow">
                  <ThinkingMessage />
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return true;
});
