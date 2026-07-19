import { useState } from 'react';
import './ReportPanel.css';

export interface ResearchReport {
  summary: string;
  key_findings: string[];
  sources: Array<{ title: string; url: string }>;
  confidence: 'high' | 'medium' | 'low';
  word_count: number;
}

interface ReportPanelProps {
  report: ResearchReport | null;
  isLoading: boolean;
}

export default function ReportPanel({ report, isLoading }: ReportPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!report) return;

    const text = formatReportAsText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="report-panel">
      <div className="report-header">
        <h2>
          <span className="report-header-icon">📄</span>
          Research Report
        </h2>
        {report && (
          <button
            id="copy-report-btn"
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        )}
      </div>

      <div className="report-content">
        {!report && !isLoading && (
          <div className="report-empty">
            <span className="report-empty-icon">📊</span>
            <p className="report-empty-text">
              Your structured research report will appear here once ARIA
              completes its analysis.
            </p>
          </div>
        )}

        {isLoading && !report && (
          <div className="report-loading">
            <div className="loading-spinner-lg" />
            <p className="loading-text">
              ARIA is researching your topic
              <span className="loading-dots" />
            </p>
          </div>
        )}

        {report && (
          <div className="report-loaded">
            {/* ── Meta Row ────────────────────────────────── */}
            <div className="report-meta">
              <span className={`confidence-badge ${report.confidence}`}>
                <span className="confidence-dot" />
                {report.confidence} confidence
              </span>
              <span className="word-count-badge">
                {report.word_count.toLocaleString()} words
              </span>
            </div>

            {/* ── Summary ─────────────────────────────────── */}
            <div className="report-section">
              <h3 className="section-title">
                <span className="section-title-icon">📝</span>
                Summary
              </h3>
              <p className="report-summary">{report.summary}</p>
            </div>

            {/* ── Key Findings ────────────────────────────── */}
            {report.key_findings.length > 0 && (
              <div className="report-section">
                <h3 className="section-title">
                  <span className="section-title-icon">💡</span>
                  Key Findings
                </h3>
                <ol className="findings-list">
                  {report.key_findings.map((finding, i) => (
                    <li key={i} className="finding-item">
                      <span className="finding-number">{i + 1}</span>
                      <span className="finding-text">{finding}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ── Sources ─────────────────────────────────── */}
            {report.sources.length > 0 && (
              <div className="report-section">
                <h3 className="section-title">
                  <span className="section-title-icon">🔗</span>
                  Sources ({report.sources.length})
                </h3>
                <div className="sources-list">
                  {report.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-item"
                    >
                      <span className="source-icon">📎</span>
                      <div className="source-info">
                        <div className="source-title">{source.title}</div>
                        <div className="source-url">{source.url}</div>
                      </div>
                      <span className="source-external-icon">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatReportAsText(report: ResearchReport): string {
  let text = '';

  text += `RESEARCH REPORT\n`;
  text += `${'═'.repeat(50)}\n\n`;

  text += `Confidence: ${report.confidence.toUpperCase()}\n`;
  text += `Word Count: ${report.word_count}\n\n`;

  text += `SUMMARY\n${'─'.repeat(50)}\n`;
  text += `${report.summary}\n\n`;

  if (report.key_findings.length > 0) {
    text += `KEY FINDINGS\n${'─'.repeat(50)}\n`;
    report.key_findings.forEach((finding, i) => {
      text += `${i + 1}. ${finding}\n`;
    });
    text += '\n';
  }

  if (report.sources.length > 0) {
    text += `SOURCES\n${'─'.repeat(50)}\n`;
    report.sources.forEach((source) => {
      text += `• ${source.title}\n  ${source.url}\n`;
    });
  }

  return text;
}
