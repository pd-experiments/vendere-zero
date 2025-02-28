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

  // Get up to 3 tasks to display
  const displayTasks = tasks.slice(0, 3);

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'variant_generation':
        return <RectangleHorizontal className="h-4 w-4" />;
      case 'suggested_query':
        return <Globe2Icon className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const handleTaskClick = (task: typeof tasks[0]) => {
    // For now, we'll just log the task and show how it would be executed
    console.log('Task clicked:', task);

    // In a real implementation, this would:
    // 1. For suggested_query: Submit the query to the knowledge API
    // 2. For variant_generation: Submit the task to the variant generation API

    // You could use a global state manager or context to access the submit functions
    if (task.task_type === 'suggested_query') {
      alert(`Would execute query: ${task.input_data.query}`);
      // In production: submitQuery(task.input_data.query, task.input_data.deep_research, task.input_data.detail_level);
    } else if (task.task_type === 'variant_generation') {
      alert(`Would generate variants with ${task.input_data.keywords.length} keywords for ${task.input_data.target_markets.length} markets`);
      // In production: generateVariants(task.input_data);
    }
  };

  return (
    <motion.div
      className="w-full md:w-[200px] flex flex-col gap-2 bg-background/30 p-2 rounded-none border border-border/30"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground/70 font-medium mb-1 px-1">
        Suggested Tasks
      </div>
      <div className="grid grid-cols-1 gap-2">
        {displayTasks.map((task, index) => (
          <motion.div
            key={index}
            className="p-2 border border-border/20 bg-background/50 rounded-none hover:bg-background/80 transition-colors cursor-pointer group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={() => handleTaskClick(task)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTaskIcon(task.task_type)}
                <span className="text-sm font-medium truncate max-w-[110px] md:max-w-[110px]">{task.title}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRightCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" align="start" className="max-w-[250px]">
                  <p className="text-xs">{task.description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </div>
            <div className="mt-2 flex justify-between items-center">
              <div className="text-xs text-muted-foreground/70">
                {task.task_type === 'variant_generation'
                  ? `${task.input_data.keywords.length} keywords`
                  : task.task_type === 'suggested_query'
                    ? (task.input_data.deep_research ? 'Deep research' : 'Quick answer')
                    : ''}
              </div>
              <div className="h-1 w-12 bg-background/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/50"
                  style={{ width: `${task.relevance_score * 100}%` }}
                ></div>
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
          <div className="hidden md:flex justify-end pr-6">
            {hasSuggestedTasks && (
              <SuggestedTasks tasks={message.suggestedTasks} />
            )}
          </div>

          {/* Center column - Message Content - Always centered */}
          <div className={cn(
            "mx-auto w-full max-w-[800px]",
            message.role === 'assistant' ? 'pl-0' : '-ml-8'
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
