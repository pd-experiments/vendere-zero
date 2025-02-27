'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo } from 'react';

interface SuggestedActionsProps {
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

function PureSuggestedActions({ append }: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'Generate a market report',
      label: 'on emerging athleisure trends in Greater China',
      action: 'Generate a comprehensive market report on emerging athleisure trends in the Greater China region and opportunities for Nike',
    },
    {
      title: 'Conduct attribution analysis',
      label: 'for the Nike App and SNKRS digital campaigns',
      action: 'Conduct an attribution analysis for recent Nike App and SNKRS digital marketing campaigns across channels',
    },
    {
      title: 'Competitive analysis',
      label: 'against Adidas in performance footwear segment',
      action: 'Provide a competitive analysis of Nike vs Adidas in the performance footwear segment, including market share and consumer perception',
    },
    {
      title: 'Evaluate ROI',
      label: 'of athlete endorsements in North American market',
      action: 'Evaluate the ROI of Nike\'s athlete endorsement strategy in the North American market over the past fiscal year',
    },
    // {
    //   title: 'Forecast impact',
    //   label: 'of Direct-to-Consumer growth on quarterly revenue',
    //   action: 'Forecast the potential impact of accelerated Direct-to-Consumer growth on Nike\'s quarterly revenue projections',
    // },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-2 w-full">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 3 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              // window.history.replaceState({}, '', `/query/${chatId}`);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-none px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start whitespace-normal break-words"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
