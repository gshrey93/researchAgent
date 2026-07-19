import { useState, type FormEvent } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (topic: string) => void;
  isLoading: boolean;
}

const EXAMPLE_TOPICS = [
  'AI in drug discovery',
  'Quantum computing 2026',
  'Climate tech trends',
];

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();

    if (trimmed.length < 3) {
      setError('Topic must be at least 3 characters.');
      return;
    }
    if (trimmed.length > 200) {
      setError('Topic must be under 200 characters.');
      return;
    }

    setError('');
    onSearch(trimmed);
  };

  const handleChipClick = (example: string) => {
    setTopic(example);
    setError('');
    onSearch(example);
  };

  return (
    <section className="search-section">
      <div className="brand">
        <div className="brand-logo">
          <div className="brand-icon">🔬</div>
          <h1>ARIA</h1>
        </div>
        <p className="brand-subtitle">
          Autonomous Research Intelligence Agent
        </p>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <input
            id="search-input"
            className="search-input"
            type="text"
            placeholder="Enter a research topic..."
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              if (error) setError('');
            }}
            disabled={isLoading}
            autoComplete="off"
            autoFocus
          />
          <span className="search-icon">🔍</span>
        </div>

        <button
          id="research-btn"
          className={`research-btn ${isLoading ? 'loading' : ''}`}
          type="submit"
          disabled={isLoading || topic.trim().length < 3}
        >
          {isLoading ? (
            <>
              <span className="btn-spinner" />
              Researching…
            </>
          ) : (
            <>⚡ Research</>
          )}
        </button>
      </form>

      {error && (
        <div className="error-toast" role="alert">
          <span>⚠️</span>
          {error}
        </div>
      )}

      <div className="example-chips">
        <span className="example-chips-label">Try an example</span>
        {EXAMPLE_TOPICS.map((example) => (
          <button
            key={example}
            className="chip"
            onClick={() => handleChipClick(example)}
            disabled={isLoading}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
