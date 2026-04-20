import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import type { DoubtResponse, DoubtSource } from '../services/api';
import { XIcon, ArrowUpIcon } from '../components/ui/Icons';
import './DoubtsPage.css';

const DEFAULT_TOPICS = [
  '', // blank = auto-detect
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'FastAPI',
  'SQL & Databases',
  'Git & Version Control',
  'Docker & Containers',
  'REST APIs',
  'Data Structures & Algorithms',
  'System Design',
  'HTML & CSS',
  'Node.js',
  'MongoDB',
  'Linux & Shell',
  'Springboot Microservices',
  'AWS',
  'Jenkins',
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── AnswerBlock ───────────────────────────────────────────────────────────────

const AnswerBlock: React.FC<{ result: DoubtResponse }> = ({ result }) => {
  const [showSources, setShowSources] = useState(false);
  const [showImageAnalysis, setShowImageAnalysis] = useState(false);

  return (
    <div className="doubts-answer card anim-fade-up">
      {result.topic_used && (
        <div className="doubts-answer__meta">
          <span className="doubts-answer__tag">
            {result.rag_used ? 'RAG' : 'LLM'} · {result.topic_used}
          </span>
        </div>
      )}

      <div className="doubts-answer__text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result.answer}
        </ReactMarkdown>
      </div>

      {result.image_analysis && (
        <div className="doubts-answer__section">
          <button
            className="doubts-toggle-btn"
            onClick={() => setShowImageAnalysis(v => !v)}
          >
            {showImageAnalysis ? 'Hide' : 'Show'} image analysis
          </button>
          {showImageAnalysis && (
            <div className="doubts-analysis-box">
              {result.image_analysis}
            </div>
          )}
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="doubts-answer__section">
          <button
            className="doubts-toggle-btn"
            onClick={() => setShowSources(v => !v)}
          >
            {showSources ? 'Hide' : 'Show'} {result.sources.length} source chunk{result.sources.length > 1 ? 's' : ''}
          </button>
          {showSources && (
            <div className="doubts-sources">
              {result.sources.map((src: DoubtSource, i: number) => (
                <div key={i} className="doubts-source-item">
                  <span className="doubts-source-item__topic">{src.topic}</span>
                  <p className="doubts-source-item__text">{src.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── DoubtsPage ────────────────────────────────────────────────────────────────

const DoubtsPage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DoubtResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachImage = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, GIF, and WebP images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB.');
      return;
    }
    setError('');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) attachImage(file);
    },
    [attachImage],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter your doubt or question.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const data = await api.doubts.askDoubt(
        question.trim(),
        topic || undefined,
        imageFile || undefined,
      );
      setResult(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doubts-page">
      <div className="doubts-header">
        <h1 className="doubts-title">Ask a Doubt</h1>
        <p className="doubts-subtitle">
          Upload a screenshot of your code or error, ask your question, and get a
          curriculum-grounded answer.
        </p>
      </div>

      <form className="doubts-form card" onSubmit={handleSubmit}>
        {/* Image drop zone */}
        <div
          className={`doubts-dropzone ${isDragging ? 'doubts-dropzone--active' : ''} ${imagePreview ? 'doubts-dropzone--has-image' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <div className="doubts-preview-wrap">
              <img src={imagePreview} alt="Uploaded" className="doubts-preview" />
              <button
                type="button"
                className="doubts-remove-btn"
                onClick={e => { e.stopPropagation(); removeImage(); }}
                title="Remove image"
              >
                <XIcon size={14} />
              </button>
            </div>
          ) : (
            <div className="doubts-dropzone__hint">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span>Drag & drop an image or <span className="doubts-dropzone__link">browse</span></span>
              <span className="doubts-dropzone__types">PNG, JPG, GIF, WebP · max 10 MB</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {/* Topic selector */}
        <div className="doubts-field">
          <label className="doubts-label">Topic <span className="doubts-optional">(optional — auto-detected if blank)</span></label>
          <select
            className="doubts-select"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          >
            {DEFAULT_TOPICS.map(t => (
              <option key={t} value={t}>{t || 'Auto-detect from knowledge base'}</option>
            ))}
          </select>
        </div>

        {/* Question input */}
        <div className="doubts-field">
          <label className="doubts-label">Your Question</label>
          <textarea
            className="doubts-textarea"
            placeholder="e.g. Why does this code throw an IndexError? How does this algorithm work?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={4}
            disabled={loading}
          />
        </div>

        {error && <div className="doubts-error">{error}</div>}

        <button
          type="submit"
          className="doubts-submit-btn"
          disabled={loading || !question.trim()}
        >
          {loading ? (
            <>
              <span className="doubts-spinner" />
              Analysing{imageFile ? ' image and' : ''} generating answer…
            </>
          ) : (
            <>
              <ArrowUpIcon size={15} />
              Ask
            </>
          )}
        </button>
      </form>

      {result && <AnswerBlock result={result} />}
    </div>
  );
};

export default DoubtsPage;
