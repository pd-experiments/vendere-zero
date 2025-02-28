'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import Image from 'next/image';
import { sanitizeUIMessages } from '@/lib/utils';

import { PaperclipIcon, StopIcon } from '@/components/icons';
import { PreviewAttachment } from '@/components/preview-attachment';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { SuggestedActions } from '@/components/suggested-actions';
import equal from 'fast-deep-equal';
import { FaGlobeAmericas } from 'react-icons/fa';

interface CustomChatRequestOptions extends ChatRequestOptions {
  detailLevel?: number;
}

function PureMultimodalInput({
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  detailLevel = 50,
  setDetailLevel,
  deepResearch,
  setDeepResearch,
}: {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: CustomChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: CustomChatRequestOptions,
  ) => void;
  className?: string;
  detailLevel?: number;
  setDetailLevel?: Dispatch<SetStateAction<number>>;
  deepResearch?: boolean;
  setDeepResearch?: Dispatch<SetStateAction<boolean>>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    // window.history.replaceState({}, '', `/query/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
      detailLevel,
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    detailLevel,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      console.error('Error uploading files!', error);
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  return (
    <div className="relative w-full flex flex-col items-center p-4">
      <div className="w-[800px]">
        {messages.length === 0 &&
          attachments.length === 0 &&
          uploadQueue.length === 0 && (
            <div className="pb-2">
              <SuggestedActions append={append} />
            </div>
          )}

        <input
          type="file"
          className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
        />

        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div className="flex flex-row gap-2 overflow-x-scroll items-end">
            {attachments.map((attachment) => (
              <PreviewAttachment key={attachment.url} attachment={attachment} />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Send a message..."
            value={input}
            onChange={handleInput}
            className={cx(
              'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-none !text-base bg-muted pb-10 dark:border-zinc-700',
              className,
            )}
            rows={2}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();

                if (isLoading) {
                  toast.error('Please wait for the model to finish its response!');
                } else {
                  submitForm();
                }
              }
            }}
          />

          <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
            <AttachmentsButton fileInputRef={fileInputRef} isLoading={isLoading} />
            {deepResearch !== undefined && setDeepResearch !== undefined && (
              <DeepResearchButton isLoading={isLoading} input={input} deepResearch={deepResearch} setDeepResearch={setDeepResearch} />
            )}

            {setDetailLevel && (
              <div className="flex items-center ml-2 border-l pl-2 dark:border-zinc-700">
                <span className="text-xs mr-2 text-muted-foreground whitespace-nowrap">Detail Level:</span>
                <div className="w-24">
                  <Slider
                    disabled={isLoading}
                    min={0}
                    max={100}
                    step={1}
                    value={[detailLevel]}
                    onValueChange={(value) => setDetailLevel(value[0])}
                    className="w-full"
                  />
                </div>
                <span className="text-xs ml-1 text-muted-foreground">{detailLevel}%</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
            {isLoading ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.detailLevel !== nextProps.detailLevel) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.deepResearch !== nextProps.deepResearch) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-none p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 mr-1"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureDeepResearchButton({
  isLoading,
  input,
  deepResearch,
  setDeepResearch,
}: {
  isLoading: boolean;
  input: string;
  deepResearch: boolean;
  setDeepResearch: Dispatch<SetStateAction<boolean>>;
}) {
  const handleDeepResearch = (event: React.MouseEvent) => {
    event.preventDefault();
    if (input.trim().length === 0) {
      toast.error('Please enter a query for deep research');
      return;
    }
    const newValue = !deepResearch;
    console.log('Toggling deepResearch from', deepResearch, 'to', newValue);
    toast.success(newValue ? 'Deep research enabled' : 'Deep research disabled');
    setDeepResearch(newValue);
  };

  useEffect(() => {
    if (input.trim().length === 0) {
      setDeepResearch(false);
    }
  }, [input, setDeepResearch]);

  return (
    <Button
      className={`rounded-none border-[1px] py-1 px-2 h-fit font-light ${deepResearch ? 'text-blue-200 dark:border-zinc-600 dark:bg-zinc-600 hover:dark:bg-zinc-700 hover:bg-zinc-400' : 'dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200'}`}
      onClick={handleDeepResearch}
      disabled={isLoading}
      variant={deepResearch ? "secondary" : "ghost"}
      title="Deep Research"
    >
      <FaGlobeAmericas size={14} /> Deep Research
    </Button>
  );
}

const DeepResearchButton = memo(PureDeepResearchButton, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.deepResearch !== nextProps.deepResearch) return false;
  return true;
});

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      className="rounded-none p-1.5 h-fit border text-white font-light bg-black/30 dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      className="rounded-none px-2 py-1 h-fit border text-white font-light bg-black/30 dark:border-zinc-600 dark:hover:bg-zinc-800"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <Image src="/favicon.ico" alt="Vendere Logo" width={14} height={14} className="rounded-sm" />
      Ask Vendere
      {/* <ArrowUpIcon size={14} /> */}
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
