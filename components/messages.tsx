import { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from '@/components/message';
import { useScrollToBottom } from '@/components/use-scroll-to-bottom';
import { memo, useState } from 'react';
import equal from 'fast-deep-equal';
import Image from 'next/image';
import { Source } from '@/components/message-sources';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRightCircle, FileText, RectangleHorizontal, Globe2Icon } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

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

// New component for suggested tasks
function SuggestedTasks({ tasks }: { tasks: Message['suggestedTasks'] }) {
  if (!tasks || tasks.length === 0) return null;

  const displayTasks = tasks.slice(0, 3);

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'variant_generation':
        return <RectangleHorizontal className="h-4 w-4 text-white/50" />;
      case 'suggested_query':
        return <Globe2Icon className="h-4 w-4 text-white/50" />;
      default:
        return <Sparkles className="h-4 w-4 text-white/50" />;
    }
  };

  const handleTaskClick = (task: typeof tasks[0]) => {
    console.log('Task clicked:', task);

    if (task.task_type === 'suggested_query') {
      alert(`Would execute query: ${task.input_data.query}`);
    } else if (task.task_type === 'variant_generation') {
      alert(`Would generate variants with ${task.input_data.keywords.length} keywords for ${task.input_data.target_markets.length} markets`);
    }
  };

  return (
    <motion.div
      className="w-full md:w-[220px] flex flex-col gap-3 bg-background/20 backdrop-blur-sm p-2 rounded-lg border border-white/[0.08]"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="text-xs uppercase tracking-wider text-white/40 font-medium px-0.5">
        Suggested Tasks
      </div>
      <div className="flex flex-col gap-2">
        {displayTasks.map((task, index) => (
          <motion.div
            key={index}
            className="group relative"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div
              onClick={() => handleTaskClick(task)}
              className="p-2.5 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] rounded-md transition-all duration-200 cursor-pointer overflow-hidden"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1.5 bg-white/[0.05] rounded-md">
                  {getTaskIcon(task.task_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white/90 truncate">
                      {task.title}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/90"
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="start"
                        className="max-w-[250px] text-white/70 bg-background/90 backdrop-blur-sm border-white/[0.08]"
                      >
                        <p className="text-xs">{task.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="mt-1 text-xs text-white/50 line-clamp-2">
                    {task.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="text-[11px] text-white/40">
                      {task.task_type === 'variant_generation'
                        ? `${task.input_data.keywords.length} keywords`
                        : task.task_type === 'suggested_query'
                          ? (task.input_data.deep_research ? 'Deep research' : 'Quick answer')
                          : ''}
                    </div>
                    <div className="h-1 w-12 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B1E116]/30"
                        style={{ width: `${task.relevance_score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
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

  const hasSuggestedTasks =
    message.role === 'assistant' &&
    message.suggestedTasks &&
    message.suggestedTasks.length > 0;

  return (
    <div className="flex items-start justify-center w-full">
      <div className="w-full max-w-[1200px] relative">
        {/* Grid layout with responsive adjustments */}
        {/* On mobile, only show the center column */}
        {/* On tablet+, show all three columns */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_200px] items-start">
          {/* Left column - Suggested Tasks - hidden on mobile */}
          <div className="hidden md:flex justify-end pr-3">
            {hasSuggestedTasks && (
              <SuggestedTasks tasks={message.suggestedTasks} />
            )}
          </div>

          {/* Center column - Message Content - Always centered */}
          <div className={cn(
            "mx-auto w-full max-w-[800px]",
          )}>
            <PreviewMessage
              message={message}
              isLoading={isLoading}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
            />
          </div>

          {/* Right column - Image Grid - hidden on mobile */}
          <div className="hidden md:flex justify-start pl-6">
            {hasVisualContent && (
              <ImageGrid
                sources={message.sources || []}
                citations={message.citations}
              />
            )}
          </div>
        </div>

        {/* Mobile-only section for suggested tasks and image grid */}
        <div className="flex md:hidden flex-col items-center mt-4 gap-4">
          {hasSuggestedTasks && (
            <div className="w-full max-w-[400px]">
              <SuggestedTasks tasks={message.suggestedTasks} />
            </div>
          )}
          {hasVisualContent && (
            <div className="w-full max-w-[400px]">
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
            <div className="w-full max-w-[1200px] relative">
              <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_200px] items-start">
                <div className="hidden md:flex justify-end pr-6">
                  {/* Empty space for suggested tasks on thinking message */}
                </div>
                <div className="mx-auto w-full max-w-[800px]">
                  <ThinkingMessage />
                </div>
                <div className="hidden md:flex justify-start pl-6">
                  {/* Empty space for image grid on thinking message */}
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
