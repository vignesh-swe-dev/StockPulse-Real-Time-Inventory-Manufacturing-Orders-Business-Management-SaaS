"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { getAccessToken } from "../lib/api";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeEvent<T = any> {
  eventType: string;
  tenantId: string;
  entityId?: string;
  timestamp: string;
  payload?: T;
}

export function useRealtimeSocket(onEvent?: (event: RealtimeEvent) => void) {
  const { session } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenerRef = useRef(onEvent);
  listenerRef.current = onEvent;

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || !session?.tenantId) {
      setStatus("disconnected");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");
    const streamUrl = `http://localhost:4000/api/v1/realtime/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      setRetryCount(0);
    };

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as RealtimeEvent;
        setLastEvent(parsed);
        if (listenerRef.current) {
          listenerRef.current(parsed);
        }
      } catch (err) {
        // Ping or non-json message
      }
    };

    es.onerror = () => {
      setStatus("disconnected");
      es.close();
      eventSourceRef.current = null;
      // Exponential backoff reconnect (max 10s)
      const timeout = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
      setRetryCount((prev) => prev + 1);
      setTimeout(connect, timeout);
    };
  }, [session?.tenantId, retryCount]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { status, lastEvent, reconnect: connect };
}
