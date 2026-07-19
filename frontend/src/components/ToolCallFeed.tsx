import { useEffect, useRef } from 'react';
import './ToolCallFeed.css';

export interface ToolEvent {
  id: string;
  type: 'tool_start' | 'tool_result';
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
  timestamp: number;
  elapsed?: number;
}

interface ToolCallFeedProps {
  events: ToolEvent[];
  isActive: boolean;
}

/** Format milliseconds as "X.Xs" */
function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Summarize tool input for display */
function summarizeInput(tool: string, input?: Record<string, unknown>): string {
  if (!input) return '';

  switch (tool) {
    case 'web_search':
      return `"${input.query ?? ''}"`;
    case 'fetch_page':
      return `${input.url ?? ''}`;
    case 'structure_report':
      return `Structuring report for "${input.topic ?? ''}"`;
    default:
      return JSON.stringify(input);
  }
}

export default function ToolCallFeed({ events, isActive }: ToolCallFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  // Group events by tool call (pair start + result)
  const groupedEvents = groupEvents(events);

  return (
    <div className="tool-feed">
      <div className="feed-header">
        <h2>
          <span className="feed-header-icon">⚡</span>
          Tool Calls
        </h2>
        {events.length > 0 && (
          <span className="feed-counter">{groupedEvents.length}</span>
        )}
      </div>

      <div className="feed-events" ref={feedRef}>
        {groupedEvents.length === 0 ? (
          <div className="feed-empty">
            <span className="feed-empty-icon">🛠️</span>
            <p className="feed-empty-text">
              Tool calls will appear here in real-time as ARIA researches your
              topic.
            </p>
          </div>
        ) : (
          groupedEvents.map((group) => (
            <div
              key={group.id}
              className={`event-card ${group.isActive ? 'active' : ''}`}
            >
              <div className="event-card-header">
                <div className="event-card-left">
                  <span className={`tool-badge ${group.tool}`}>
                    <span
                      className={`tool-badge-dot ${group.isActive ? 'pulsing' : ''}`}
                    />
                    {group.tool}
                  </span>
                  <span
                    className={`event-status ${group.isActive ? 'status-running' : 'status-done'}`}
                  >
                    {group.isActive ? '● running' : '✓ done'}
                  </span>
                </div>
                {group.elapsed !== undefined && (
                  <span className="elapsed-time">
                    {formatElapsed(group.elapsed)}
                  </span>
                )}
              </div>

              {group.inputSummary && (
                <div className="event-input">{group.inputSummary}</div>
              )}

              {group.result && (
                <div className="event-result">{group.result}</div>
              )}
            </div>
          ))
        )}

        {/* Active indicator at bottom */}
        {isActive && groupedEvents.length > 0 && (
          <div className="event-card active" style={{ opacity: 0.6 }}>
            <div className="event-card-header">
              <div className="event-card-left">
                <span className="tool-badge web_search" style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--border-accent)' }}>
                  <span className="tool-badge-dot pulsing" />
                  thinking…
                </span>
                <span className="event-status status-running">● processing</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event Grouping ──────────────────────────────────────────────────────────

interface GroupedEvent {
  id: string;
  tool: string;
  inputSummary: string;
  result?: string;
  isActive: boolean;
  elapsed?: number;
}

function groupEvents(events: ToolEvent[]): GroupedEvent[] {
  const groups: GroupedEvent[] = [];
  const startMap = new Map<string, ToolEvent>();

  for (const event of events) {
    if (event.type === 'tool_start') {
      // Create a unique ID based on tool + timestamp
      const key = `${event.tool}-${event.timestamp}`;
      startMap.set(key, event);
      groups.push({
        id: event.id,
        tool: event.tool,
        inputSummary: summarizeInput(event.tool, event.input),
        isActive: true,
        elapsed: undefined,
      });
    } else if (event.type === 'tool_result') {
      // Find the matching start event (most recent one for this tool)
      const group = [...groups].reverse().find(
        (g) => g.tool === event.tool && g.isActive
      );
      if (group) {
        group.result = event.result;
        group.isActive = false;
        group.elapsed = event.elapsed;
      }
    }
  }

  return groups;
}
