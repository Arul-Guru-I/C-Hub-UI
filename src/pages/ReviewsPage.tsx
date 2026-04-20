import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type {
  Feedback,
  UserInDB,
  PerformanceLog,
  CombinedFeedbackResponse,
  ProjectCollection,
  ProjectIngestResponse,
} from '../services/api';
import { PlusIcon } from '../components/ui/Icons';
import PerformanceCharts from '../components/charts/PerformanceCharts';
import './ReviewsPage.css';

type ReviewTab = 'manual' | 'combined' | 'content';

// ── Helpers ────────────────────────────────────────────────────────────────

const scoreColor = (score: number) =>
  score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
const scoreBg = (score: number) =>
  score >= 75 ? 'rgba(62,207,142,0.15)' : score >= 50 ? 'rgba(245,176,117,0.15)' : 'rgba(235,87,87,0.15)';

// ── Sub-components ─────────────────────────────────────────────────────────

interface IngestBannerProps { result: ProjectIngestResponse; onDismiss: () => void; }
const IngestBanner: React.FC<IngestBannerProps> = ({ result, onDismiss }) => (
  <div className="rv-ingest-banner rv-ingest-banner--success">
    <span>{result.message} <strong>({result.chunks_ingested} chunks)</strong></span>
    <button className="rv-ingest-banner__close" onClick={onDismiss}>×</button>
  </div>
);

interface IngestErrorProps { message: string; }
const IngestError: React.FC<IngestErrorProps> = ({ message }) => (
  <div className="rv-ingest-banner rv-ingest-banner--error">{message}</div>
);

// ── Main Component ─────────────────────────────────────────────────────────

const ReviewsPage: React.FC = () => {
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<ReviewTab>('manual');

  // ── Manual Feedback tab ──
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([]);
  const [cohortLogs, setCohortLogs] = useState<PerformanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<UserInDB[]>([]);
  const [fbTargetUserId, setFbTargetUserId] = useState('');
  const [fbPrNumber, setFbPrNumber] = useState('');
  const [fbContent, setFbContent] = useState('');
  const [formError, setFormError] = useState('');

  // ── PR Reviews (combined) tab ──
  const [combinedData, setCombinedData] = useState<CombinedFeedbackResponse | null>(null);
  const [isCombinedLoading, setIsCombinedLoading] = useState(false);

  // ── Content Management tab ──
  const [collections, setCollections] = useState<ProjectCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);

  // Unified ingest form
  const [ingestMode, setIngestMode] = useState<'text' | 'file'>('text');
  const [ingestTopic, setIngestTopic] = useState('');
  const [ingestSource, setIngestSource] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingestSubmitting, setIngestSubmitting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<ProjectIngestResponse | null>(null);
  const [ingestError, setIngestError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const idToUse = user._id || user.email;
      try {
        const [fbData, perfData] = await Promise.all([
          api.feedbacks.listFeedback(idToUse),
          api.performance.getPerformance(idToUse),
        ]);
        setFeedbacks(Array.isArray(fbData) ? fbData : []);
        setPerfLogs(Array.isArray(perfData) ? perfData : []);
      } catch (err) {
        console.error('Failed to fetch reviews data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const fetchCohort = async () => {
      if (!user || !isTrainer) return;
      try {
        const allUsers = await api.users.listUsers(0, 100);
        const results = await Promise.allSettled(
          allUsers
            .filter(u => u._id && u._id !== user._id)
            .map(u => api.performance.getPerformance(u._id!))
        );
        const combined: PerformanceLog[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) combined.push(...r.value);
        }
        setCohortLogs(combined);
      } catch (err) {
        console.error('Failed to fetch cohort data', err);
      }
    };
    fetchCohort();
  }, [user, isTrainer]);

  useEffect(() => {
    if (activeTab !== 'combined' || combinedData !== null) return;
    const fetchCombined = async () => {
      if (!user) return;
      const idToUse = user._id || user.email;
      setIsCombinedLoading(true);
      try {
        const data = await api.feedbacks.getCombinedFeedback(idToUse);
        setCombinedData(data);
      } catch (err) {
        console.error('Failed to fetch combined feedback', err);
        setCombinedData({ performances: [], feedbacks: [] });
      } finally {
        setIsCombinedLoading(false);
      }
    };
    fetchCombined();
  }, [activeTab, combinedData, user]);

  useEffect(() => {
    if (activeTab !== 'content' || collectionsLoaded) return;
    loadCollections();
  }, [activeTab, collectionsLoaded]);

  // ── Collections helpers ────────────────────────────────────────────────

  const loadCollections = async () => {
    setCollectionsLoading(true);
    try {
      const data = await api.projectContent.listCollections();
      setCollections(data.collections ?? []);
      setCollectionsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch collections', err);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const handleDeleteCollection = async (topic: string) => {
    if (!window.confirm(`Delete all evaluation content for "${topic}"? This cannot be undone.`)) return;
    setDeletingTopic(topic);
    try {
      await api.projectContent.deleteCollection(topic);
      setCollections(prev => prev.filter(c => c.topic !== topic));
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      alert(status === 404
        ? 'Collection not found. It may have already been deleted.'
        : (typeof detail === 'string' ? detail : 'Failed to delete collection.')
      );
    } finally {
      setDeletingTopic(null);
    }
  };

  // ── Unified ingest ─────────────────────────────────────────────────────

  const handleIngestSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIngestError('');
    setIngestSuccess(null);
    setIngestSubmitting(true);
    try {
      let result: ProjectIngestResponse;
      if (ingestMode === 'text') {
        result = await api.projectContent.ingestText(ingestTopic, ingestContent, ingestSource || undefined);
        setIngestContent('');
        setIngestSource('');
      } else {
        result = await api.projectContent.ingestFile(ingestTopic, selectedFile!);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      setIngestSuccess(result);
      setCollectionsLoaded(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403) setIngestError('Only trainers can ingest content.');
      else setIngestError(typeof detail === 'string' ? detail : 'Failed to ingest content.');
    } finally {
      setIngestSubmitting(false);
    }
  };

  // ── Manual feedback helpers ────────────────────────────────────────────

  const handleOpenForm = async () => {
    setShowForm(true);
    if (users.length === 0) {
      try {
        const data = await api.users.listUsers(0, 100);
        setUsers(data);
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fbTargetUserId || !fbPrNumber || !fbContent.trim()) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await api.feedbacks.createFeedback({
        user_id: fbTargetUserId,
        pr_number: parseInt(fbPrNumber, 10),
        content: fbContent,
      });
      setShowForm(false);
      setFbTargetUserId('');
      setFbPrNumber('');
      setFbContent('');
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403) setFormError('Only trainers can submit feedback.');
      else if (status === 401) setFormError('Your session has expired. Please log in again.');
      else setFormError(typeof detail === 'string' ? detail : 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────

  const avgScore = feedbacks.length > 0
    ? Math.round(feedbacks.reduce((s, fb) => s + (fb.score ?? 0), 0) / feedbacks.filter(fb => fb.score != null).length) || null
    : null;

  const combinedFeedbacks = combinedData?.feedbacks ?? [];
  const combinedPerformances = combinedData?.performances ?? [];
  const combinedAvgScore = combinedFeedbacks.length > 0
    ? Math.round(combinedFeedbacks.reduce((s, fb) => s + (fb.score ?? 0), 0) / combinedFeedbacks.filter(fb => fb.score != null).length) || null
    : combinedPerformances.length > 0
      ? Math.round(combinedPerformances.reduce((s, p) => s + p.score, 0) / combinedPerformances.length)
      : null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="page-content reviews-page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Code Feedback</h1>
          <p>Review feedback received from reviewers based on your pulled code.</p>
        </div>
        {isTrainer && activeTab === 'manual' && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenForm}>
            <PlusIcon size={14} /> Submit Feedback
          </button>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div className="rv-tab-bar">
        <button className={`rv-tab-btn${activeTab === 'manual' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('manual')}>
          Trainer Feedback
        </button>
        <button className={`rv-tab-btn${activeTab === 'combined' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('combined')}>
          PR Reviews
        </button>
        {isTrainer && (
          <button className={`rv-tab-btn${activeTab === 'content' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('content')}>
            Evaluation Content
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Trainer Feedback (manual)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <>
          {showForm && (
            <form onSubmit={handleSubmitFeedback} className="card anim-fade-up" style={{ marginBottom: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-light)', fontSize: '1.1rem' }}>Submit Feedback for a PR</h3>
              {formError && <div className="login-error">{formError}</div>}
              <div className="form-group">
                <label>Developer</label>
                <select required value={fbTargetUserId} onChange={e => setFbTargetUserId(e.target.value)} className="form-input" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px' }}>
                  <option value="">Select a user…</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>PR Number</label>
                <input type="number" required min="1" value={fbPrNumber} onChange={e => setFbPrNumber(e.target.value)} className="form-input" placeholder="42" />
              </div>
              <div className="form-group">
                <label>Feedback</label>
                <textarea required value={fbContent} onChange={e => setFbContent(e.target.value)} className="form-input" placeholder="Write your code review feedback…" style={{ minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          )}

          <PerformanceCharts logs={perfLogs} cohortLogs={cohortLogs} />

          <div className="reviews-stats grid-3" style={{ marginBottom: '24px' }}>
            <div className="card card-gradient review-stat-card">
              <span className="review-stat-card__value" style={{ color: 'var(--color-info)' }}>{feedbacks.length}</span>
              <span className="review-stat-card__label">Total Feedbacks Received</span>
            </div>
            {avgScore != null && (
              <div className="card card-gradient review-stat-card">
                <span className="review-stat-card__value" style={{ color: scoreColor(avgScore) }}>{avgScore}</span>
                <span className="review-stat-card__label">Average Score</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Loading feedback...</div>
          ) : (
            <div className="reviews-list">
              {feedbacks.map((fb, ix) => (
                <div key={fb._id || ix} className="review-card card anim-fade-up" style={{ padding: '24px' }}>
                  <div className="review-card__header">
                    <div className="review-card__title-row">
                      <h3 className="review-card__title">PR #{fb.pr_number}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {fb.score != null && (
                          <span className="badge" style={{ background: scoreBg(fb.score), color: scoreColor(fb.score), fontWeight: 700, fontSize: '13px' }}>Score: {fb.score}</span>
                        )}
                        <span className="badge badge-info">Feedback</span>
                      </div>
                    </div>
                  </div>
                  <div className="review-card__meta" style={{ marginTop: '12px', marginBottom: '16px' }}>
                    <div className="review-card__author">
                      <div className="review-card__avatar" style={{ background: 'var(--color-primary)' }}>{fb.reviewer_name?.charAt(0).toUpperCase() || '?'}</div>
                      <span>Reviewed by {fb.reviewer_name}</span>
                    </div>
                  </div>
                  {fb.summary && (
                    <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(30,58,138,0.08)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-light)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', fontStyle: 'italic' }}>
                      {fb.summary}
                    </div>
                  )}
                  <div className="feedback-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{fb.content}</ReactMarkdown>
                  </div>
                  <div className="review-card__footer" style={{ marginTop: '16px' }}>
                    {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : 'System'}
                  </div>
                </div>
              ))}
              {feedbacks.length === 0 && <div className="tasks-empty">No feedback found. Looks good!</div>}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: PR Reviews (combined / automated)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'combined' && (
        <>
          {isCombinedLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Loading PR reviews...</div>
          ) : (
            <>
              <div className="reviews-stats grid-3" style={{ marginBottom: '24px' }}>
                <div className="card card-gradient review-stat-card">
                  <span className="review-stat-card__value" style={{ color: 'var(--color-info)' }}>{combinedFeedbacks.length}</span>
                  <span className="review-stat-card__label">Automated Reviews</span>
                </div>
                <div className="card card-gradient review-stat-card">
                  <span className="review-stat-card__value" style={{ color: 'var(--color-accent)' }}>{combinedPerformances.length}</span>
                  <span className="review-stat-card__label">Performance Records</span>
                </div>
                {combinedAvgScore != null && (
                  <div className="card card-gradient review-stat-card">
                    <span className="review-stat-card__value" style={{ color: scoreColor(combinedAvgScore) }}>{combinedAvgScore}</span>
                    <span className="review-stat-card__label">Average Score</span>
                  </div>
                )}
              </div>

              {combinedPerformances.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <h2 className="rv-section-title">Performance Records</h2>
                  <div className="rv-perf-grid">
                    {combinedPerformances.map((p, ix) => (
                      <div key={ix} className="card rv-perf-card">
                        <div className="rv-perf-card__score" style={{ color: scoreColor(p.score) }}>{p.score}</div>
                        <div className="rv-perf-card__meta">
                          {p.pr_number != null && <span className="rv-perf-card__pr">PR #{p.pr_number}</span>}
                          {p.pr_author_name && <span className="rv-perf-card__author">{p.pr_author_name}{p.pr_author_github && <span className="rv-perf-card__github"> @{p.pr_author_github}</span>}</span>}
                          {p.created_at && <span className="rv-perf-card__date">{new Date(p.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="rv-section-title">Automated Feedback</h2>
              <div className="reviews-list">
                {combinedFeedbacks.map((fb, ix) => (
                  <div key={ix} className="review-card card anim-fade-up rv-combined-card" style={{ padding: '24px' }}>
                    <div className="review-card__header">
                      <div className="review-card__title-row">
                        <h3 className="review-card__title">
                          {fb.pr_number != null ? `PR #${fb.pr_number}` : 'Review'}
                          {fb.pr_author_name && (
                            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: '13px', marginLeft: '8px' }}>
                              by {fb.pr_author_name}{fb.pr_author_github && <span style={{ color: 'var(--color-text-muted)' }}> (@{fb.pr_author_github})</span>}
                            </span>
                          )}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {fb.score != null && (
                            <span className="badge" style={{ background: scoreBg(fb.score), color: scoreColor(fb.score), fontWeight: 700, fontSize: '13px' }}>Score: {fb.score}</span>
                          )}
                          <span className="badge rv-auto-badge">Auto</span>
                        </div>
                      </div>
                    </div>
                    {fb.summary && (
                      <div style={{ margin: '12px 0', padding: '12px 16px', background: 'rgba(0,212,170,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--color-accent)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', fontStyle: 'italic' }}>
                        {fb.summary}
                      </div>
                    )}
                    {fb.content && (
                      <div className="feedback-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{fb.content}</ReactMarkdown>
                      </div>
                    )}
                    {fb.created_at && <div className="review-card__footer" style={{ marginTop: '16px' }}>{new Date(fb.created_at).toLocaleDateString()}</div>}
                  </div>
                ))}
                {combinedFeedbacks.length === 0 && <div className="tasks-empty">No automated feedback found.</div>}
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Evaluation Content (ChromaDB management — trainer only)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'content' && isTrainer && (
        <div className="rv-content-tab">

          {/* ── Ingest Form ── */}
          <div className="card rv-ingest-card">
            <div className="rv-ingest-card__header">
              <div>
                <h3 className="rv-ingest-card__title">Add Evaluation Content</h3>
                <p className="rv-ingest-card__desc">Add rubrics, expected patterns, or grading criteria for a project topic.</p>
              </div>
              <div className="rv-mode-toggle">
                <button
                  type="button"
                  className={`rv-mode-btn${ingestMode === 'text' ? ' rv-mode-btn--active' : ''}`}
                  onClick={() => { setIngestMode('text'); setIngestError(''); setIngestSuccess(null); }}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  className={`rv-mode-btn${ingestMode === 'file' ? ' rv-mode-btn--active' : ''}`}
                  onClick={() => { setIngestMode('file'); setIngestError(''); setIngestSuccess(null); }}
                >
                  Upload File
                </button>
              </div>
            </div>

            {ingestSuccess && <IngestBanner result={ingestSuccess} onDismiss={() => setIngestSuccess(null)} />}
            {ingestError && <IngestError message={ingestError} />}

            <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>Project Topic <span className="rv-required">*</span></label>
                <input
                  type="text"
                  required
                  value={ingestTopic}
                  onChange={e => setIngestTopic(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Flask REST API, React Basics"
                />
              </div>

              {ingestMode === 'text' ? (
                <>
                  <div className="form-group">
                    <label>Evaluation Content <span className="rv-required">*</span></label>
                    <textarea
                      required
                      value={ingestContent}
                      onChange={e => setIngestContent(e.target.value)}
                      className="form-input rv-content-textarea"
                      placeholder="Paste rubric, expected patterns, or reference material here."
                    />
                  </div>
                  <div className="form-group">
                    <label>Source Label</label>
                    <input
                      type="text"
                      value={ingestSource}
                      onChange={e => setIngestSource(e.target.value)}
                      className="form-input"
                      placeholder="e.g. rubric_v2, lecture_notes (optional)"
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Upload File <span className="rv-required">*</span></label>
                  <div className="rv-file-drop">
                    <input
                      ref={fileInputRef}
                      type="file"
                      required
                      accept=".pdf,.md,.txt"
                      className="rv-file-input"
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="rv-file-drop__inner">
                      {selectedFile
                        ? <span className="rv-file-drop__name">{selectedFile.name}</span>
                        : <span className="rv-file-drop__placeholder">Choose file…</span>
                      }
                      <span className="rv-file-drop__hint">Allowed: .pdf, .md, .txt</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={ingestSubmitting || (ingestMode === 'file' && !selectedFile)}
                style={{ alignSelf: 'flex-end' }}
              >
                {ingestSubmitting
                  ? (ingestMode === 'text' ? 'Ingesting…' : 'Uploading…')
                  : (ingestMode === 'text' ? 'Ingest Text' : 'Upload & Ingest')
                }
              </button>
            </form>
          </div>

          {/* ── Collections Table ── */}
          <div style={{ marginTop: '32px' }}>
            <div className="rv-collections-header">
              <h2 className="rv-section-title" style={{ margin: 0 }}>Ingested Collections</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setCollectionsLoaded(false); }}
                disabled={collectionsLoading}
              >
                {collectionsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {collectionsLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading collections…</div>
            ) : collections.length === 0 ? (
              <div className="tasks-empty">No evaluation content ingested yet.</div>
            ) : (
              <div className="rv-collections-table-wrap card" style={{ padding: 0 }}>
                <table className="rv-collections-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Collection</th>
                      <th style={{ textAlign: 'right' }}>Chunks Stored</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map(col => (
                      <tr key={col.topic}>
                        <td className="rv-col-topic">{col.topic}</td>
                        <td><span className="rv-col-collection">{col.collection}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge" style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--color-primary-light)' }}>
                            {col.document_count}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn rv-delete-btn btn-sm"
                            onClick={() => handleDeleteCollection(col.topic)}
                            disabled={deletingTopic === col.topic}
                          >
                            {deletingTopic === col.topic ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
