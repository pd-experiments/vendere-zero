import { useEffect, useRef } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
    React.RefObject<T>,
    React.RefObject<HTMLDivElement>
] {
    const containerRef = useRef<T>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when the ref changes or when the component mounts
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messagesEndRef]);

    // This effect will run when new messages are added
    useEffect(() => {
        const scrollToBottom = () => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        };

        // Small delay to ensure DOM has updated
        const timeoutId = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeoutId);
    });

    return [containerRef, messagesEndRef];
} 