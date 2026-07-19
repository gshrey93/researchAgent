import { useState } from 'react';
import './ReportPanel.css';

export interface ResearchReport {
  summary: string;
  key_findings: string[];
  action_items?: string[];
  follow_up_questions?: string[];
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

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const text = formatReportAsMarkdown(report);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Research_Report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-panel">
      <div className="report-header">
        <h2>
          <span className="report-header-icon">📄</span>
          Research Report
        </h2>
        {report && (
          <div className="report-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              id="download-md-btn"
              className="copy-btn"
              onClick={handleDownloadMarkdown}
            >
              ⬇️ Markdown
            </button>
            <button
              id="copy-report-btn"
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
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

            {/* ── Action Items ────────────────────────────── */}
            {report.action_items && report.action_items.length > 0 && (
              <div className="report-section">
                <h3 className="section-title">
                  <span className="section-title-icon">✅</span>
                  Action Items
                </h3>
                <ul className="findings-list" style={{ listStyleType: 'none', padding: 0 }}>
                  {report.action_items.map((item, i) => (
                    <li key={i} className="finding-item" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>☑️</span>
                      <span className="finding-text">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Follow-up Questions ─────────────────────── */}
            {report.follow_up_questions && report.follow_up_questions.length > 0 && (
              <div className="report-section">
                <h3 className="section-title">
                  <span className="section-title-icon">❓</span>
                  Follow-up Questions
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {report.follow_up_questions.map((q, i) => (
                    <div key={i} style={{ 
                      background: 'var(--bg-elevated)', 
                      padding: '8px 12px', 
                      borderRadius: '16px', 
                      fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)'
                    }}>
                      {q}
                    </div>
                  ))}
                </div>
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

  if (report.action_items && report.action_items.length > 0) {
    text += `ACTION ITEMS\n${'─'.repeat(50)}\n`;
    report.action_items.forEach((item) => {
      text += `[ ] ${item}\n`;
    });
    text += '\n';
  }

  if (report.follow_up_questions && report.follow_up_questions.length > 0) {
    text += `FOLLOW-UP QUESTIONS\n${'─'.repeat(50)}\n`;
    report.follow_up_questions.forEach((q) => {
      text += `? ${q}\n`;
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

function formatReportAsMarkdown(report: ResearchReport): string {
  let md = '';

  md += `# Research Report\n\n`;
  md += `**Confidence:** ${report.confidence.toUpperCase()} | **Word Count:** ${report.word_count}\n\n`;

  md += `## Summary\n\n${report.summary}\n\n`;

  if (report.key_findings.length > 0) {
    md += `## Key Findings\n\n`;
    report.key_findings.forEach((finding, i) => {
      md += `${i + 1}. ${finding}\n`;
    });
    md += '\n';
  }

  if (report.action_items && report.action_items.length > 0) {
    md += `## Action Items\n\n`;
    report.action_items.forEach((item) => {
      md += `- [ ] ${item}\n`;
    });
    md += '\n';
  }

  if (report.follow_up_questions && report.follow_up_questions.length > 0) {
    md += `## Follow-up Questions\n\n`;
    report.follow_up_questions.forEach((q) => {
      md += `- ${q}\n`;
    });
    md += '\n';
  }

  if (report.sources.length > 0) {
    md += `## Sources\n\n`;
    report.sources.forEach((source) => {
      md += `- [${source.title}](${source.url})\n`;
    });
  }

  return md;
}
