"use client";

import { useEffect, useState, useRef } from "react";
import { DockerMetrics } from "@/types/docker";

interface MetricsPayload {
  type: string;
  timestamp: string;
  data: Record<string, DockerMetrics>;
}

const POLL_INTERVAL_MS = 5000;

export function useMetricsStream() {
  const [metrics, setMetrics] = useState<Record<string, DockerMetrics>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetricsPolling = useRef(async () => {
    try {
      const res = await fetch("/api/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // Ignore polling errors
    }
  });

  useEffect(() => {
    const connect = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.hostname}:3001`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          setError(null);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload: MetricsPayload = JSON.parse(event.data);
            if (payload.type === "metrics") {
              setMetrics(payload.data);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          setConnected(false);
          setError(null);
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // When WebSocket is disconnected, poll /api/metrics so dashboard still shows data
  useEffect(() => {
    if (connected) return;

    fetchMetricsPolling.current();

    pollIntervalRef.current = setInterval(() => {
      fetchMetricsPolling.current();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [connected]);

  return {
    metrics,
    connected,
    error,
  };
}
