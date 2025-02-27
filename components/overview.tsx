'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';

export function Overview() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center gap-6 px-4 py-12 text-center"
        >
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">Knowledge Base</h1>
                <p className="text-muted-foreground max-w-md">
                    Ask questions about your data and get detailed answers with sources.
                    Toggle &quot;Deep Research&quot; for more comprehensive analysis.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                <ExampleCard
                    title="Simple Query"
                    description="What are the key market trends in our industry?"
                />
                <ExampleCard
                    title="Deep Research"
                    description="Analyze our competitive positioning and provide recommendations."
                />
                <ExampleCard
                    title="Data Analysis"
                    description="Summarize our sales performance over the last quarter."
                />
                <ExampleCard
                    title="Strategic Insights"
                    description="What opportunities should we focus on in the next fiscal year?"
                />
            </div>
        </motion.div>
    );
}

function ExampleCard({ title, description }: { title: string; description: string }) {
    return (
        <Button
            variant="outline"
            className="flex flex-col items-start gap-1 p-4 h-auto text-left"
        >
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
        </Button>
    );
} 