import { useEffect, useRef, useCallback } from 'react';

type EventType = 'CHART_CREATED' | 'DATA_REFRESHED' | 'VERSION_COMMITTED' | 'WIDGET_ADDED' | 'REPORT_UPDATED';

interface SyncEvent {
    type: EventType;
    payload: any;
    timestamp: number;
    sourceId: string; // To avoid processing own events if needed
}

export function useModuleSync(channelName: string = 'toeasy-sync') {
    const channelRef = useRef<BroadcastChannel | null>(null);
    const listenersRef = useRef<Set<(event: SyncEvent) => void>>(new Set());
    const sourceId = useRef(Math.random().toString(36).substr(2, 9));

    useEffect(() => {
        // Initialize channel
        channelRef.current = new BroadcastChannel(channelName);

        const handleMessage = (event: MessageEvent) => {
            const data = event.data as SyncEvent;
            // Don't process own messages if we want that behavior, 
            // but usually we want to react to everything or filter at component level
            listenersRef.current.forEach(listener => listener(data));
        };

        channelRef.current.onmessage = handleMessage;

        return () => {
            channelRef.current?.close();
        };
    }, [channelName]);

    const broadcast = useCallback((type: EventType, payload: any) => {
        if (channelRef.current) {
            channelRef.current.postMessage({
                type,
                payload,
                timestamp: Date.now(),
                sourceId: sourceId.current
            });
        }
    }, []);

    const subscribe = useCallback((callback: (event: SyncEvent) => void) => {
        listenersRef.current.add(callback);
        return () => {
            listenersRef.current.delete(callback);
        };
    }, []);

    return { broadcast, subscribe };
}
