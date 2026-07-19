import { useState, useCallback, useRef } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import ToolCallFeed, { type ToolEvent } from './components/ToolCallFeed';
import ReportPanel, { type ResearchReport } from './components/ReportPanel';

const API_BASE = 'http://localhost:8000';

type AppState = 'idle' | 'researching' | 'complete' | 'error';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [events, setEvents] = useState<ToolEvent[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const eventIdCounter = useRef(0);

  const handleSearch = useCallback(async (topic: string) => {
    // Abort any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Reset state
    setState('researching');
    setEvents([]);
    setReport(null);
    setError(null);
    eventIdCounter.current = 0;

    try {
      const response = await fetch(`${API_BASE}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const message =
          errData?.detail?.message ??
          errData?.detail ??
          `Server error (${response.status})`;
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('No response stream received');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6); // Remove "data: "
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            handleSSEEvent(event);
          } catch {
            // Skip malformed events
            console.warn('Malformed SSE event:', data);
          }
        }
      }

      // If we finished without a complete event, mark as complete
      setState((prev) => (prev === 'researching' ? 'complete' : prev));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // User cancelled, don't show error
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setState('error');
    }
  }, []);

  const handleSSEEvent = useCallback(
    (event: { type: string; tool?: string; input?: Record<string, unknown>; result?: string; report?: ResearchReport; message?: string }) => {
      const now = Date.now();

      switch (event.type) {
        case 'tool_start':
          setEvents((prev) => [
            ...prev,
            {
              id: `evt-${++eventIdCounter.current}`,
              type: 'tool_start',
              tool: event.tool ?? 'unknown',
              input: event.input,
              timestamp: now,
            },
          ]);
          break;

        case 'tool_result':
          setEvents((prev) => {
            // Find the most recent matching tool_start that hasn't been completed
            const updated = [...prev];
            const startEvent = [...updated]
              .reverse()
              .find(
                (e) =>
                  e.type === 'tool_start' &&
                  e.tool === event.tool &&
                  !updated.some(
                    (r) =>
                      r.type === 'tool_result' &&
                      r.tool === event.tool &&
                      r.timestamp > e.timestamp
                  )
              );
            const elapsed = startEvent ? now - startEvent.timestamp : undefined;

            return [
              ...updated,
              {
                id: `evt-${++eventIdCounter.current}`,
                type: 'tool_result',
                tool: event.tool ?? 'unknown',
                result: event.result,
                timestamp: now,
                elapsed,
              },
            ];
          });
          break;

        case 'complete':
          if (event.report) {
            setReport(event.report);
          }
          setState('complete');
          break;

        case 'error':
          setError(event.message ?? 'Unknown error occurred');
          setState('error');
          break;
      }
    },
    []
  );

  const isResearching = state === 'researching';
  const hasResults = state !== 'idle';

  return (
    <div className="app">
      {/* ── Search Header ──────────────────────────────── */}
      <div className={`app-search-header ${hasResults ? 'compact' : ''}`}>
        <SearchBar onSearch={handleSearch} isLoading={isResearching} />
      </div>

      {/* ── Error Banner ───────────────────────────────── */}
      {error && (
        <div className="app-error-banner" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Results Split ──────────────────────────────── */}
      {hasResults && (
        <div className="app-results">
          <ToolCallFeed events={events} isActive={isResearching} />
          <ReportPanel report={report} isLoading={isResearching} />
        </div>
      )}
    </div>
  );
}
