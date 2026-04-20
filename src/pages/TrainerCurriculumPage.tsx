import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import type { LPCohort, LPCohortDetail, LPAssessmentQuestion, LPCollection } from '../services/api';
import { PlusIcon, TrashIcon, RefreshIcon, FileIcon } from '../components/ui/Icons';
import './TrainerCurriculumPage.css';

type Tab = 'cohorts' | 'content' | 'questions';

// ── Small helpers ─────────────────────────────────────────────────────────────
const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button className={`tc-tab ${active ? 'tc-tab--active' : ''}`} onClick={onClick}>{children}</button>
);

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, hint, children }) => (
  <div className="tc-field">
    <label className="tc-label">{label}{hint && <span className="tc-hint"> — {hint}</span>}</label>
    {children}
  </div>
);

// ── Tab: Cohorts ──────────────────────────────────────────────────────────────
const CohortsTab: React.FC<{ cohorts: LPCohort[]; onRefresh: () => void }> = ({ cohorts, onRefresh }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('📚');
  const [desc, setDesc] = useState('');
  const [stack, setStack] = useState('');
  const [weeks, setWeeks] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const autoSlug = (n: string) => n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleCreate = async () => {
    if (!name || !slug) { setError('Name and slug are required'); return; }
    setLoading(true); setError('');
    try {
      await api.learningPath.createCohort({
        name, slug, icon, description: desc,
        tech_stack: stack.split(',').map(s => s.trim()).filter(Boolean),
        duration_weeks: weeks, phases: [],
      });
      setCreating(false); setName(''); setSlug(''); setDesc(''); setStack('');
      onRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create cohort');
    } finally { setLoading(false); }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete cohort "${slug}"? This cannot be undone.`)) return;
    setDeleting(slug);
    try { await api.learningPath.deleteCohort(slug); onRefresh(); }
    catch { alert('Failed to delete cohort'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="tc-section">
      <div className="tc-section-head">
        <h2 className="tc-section-title">Cohorts</h2>
        <button className="tc-btn tc-btn--primary" onClick={() => setCreating(v => !v)}>
          <PlusIcon size={13} /> New Cohort
        </button>
      </div>

      {creating && (
        <div className="tc-form card">
          <h3 className="tc-form-title">Create Cohort</h3>
          {error && <div className="tc-error">{error}</div>}
          <div className="tc-form-grid">
            <Field label="Name"><input className="tc-input" placeholder="e.g. Java Full Stack Developer" value={name} onChange={e => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }} /></Field>
            <Field label="Slug" hint="URL-friendly ID"><input className="tc-input" placeholder="java-fsd" value={slug} onChange={e => setSlug(e.target.value)} /></Field>
            <Field label="Icon"><input className="tc-input" placeholder="☕" value={icon} onChange={e => setIcon(e.target.value)} style={{ maxWidth: 80 }} /></Field>
            <Field label="Duration (weeks)"><input type="number" className="tc-input" value={weeks} onChange={e => setWeeks(+e.target.value)} min={4} max={52} style={{ maxWidth: 100 }} /></Field>
          </div>
          <Field label="Description"><textarea className="tc-textarea" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description of the cohort" /></Field>
          <Field label="Tech Stack" hint="comma-separated"><input className="tc-input" placeholder="Java, Spring Boot, React, MySQL" value={stack} onChange={e => setStack(e.target.value)} /></Field>
          <div className="tc-form-actions">
            <button className="tc-btn tc-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="tc-btn tc-btn--primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create Cohort'}
            </button>
          </div>
        </div>
      )}

      <div className="tc-cohort-list">
        {cohorts.map(c => (
          <div key={c.slug} className="tc-cohort-row card">
            <div className="tc-cohort-row__left">
              <span className="tc-cohort-row__icon">{c.icon}</span>
              <div>
                <p className="tc-cohort-row__name">{c.name}</p>
                <p className="tc-cohort-row__meta">{c.slug} · {c.duration_weeks}w · {c.tech_stack?.join(', ')}</p>
              </div>
            </div>
            <button className="tc-btn tc-btn--danger-ghost" onClick={() => handleDelete(c.slug)} disabled={deleting === c.slug}>
              <TrashIcon size={13} /> {deleting === c.slug ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        ))}
        {cohorts.length === 0 && <p className="tc-empty">No cohorts yet. Create your first one above.</p>}
      </div>
    </div>
  );
};

// ── Tab: Content (Knowledge Base) ─────────────────────────────────────────────
const ContentTab: React.FC<{ cohorts: LPCohort[] }> = ({ cohorts }) => {
  const [selSlug, setSelSlug] = useState(cohorts[0]?.slug || '');
  const [topic, setTopic] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [collections, setCollections] = useState<LPCollection[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadCollections = async (slug: string) => {
    setLoadingCols(true);
    try { const r = await api.learningPath.listCollections(slug); setCollections(r.collections); }
    catch { setCollections([]); }
    finally { setLoadingCols(false); }
  };

  useEffect(() => { if (selSlug) loadCollections(selSlug); }, [selSlug]);

  const handleUpload = async () => {
    if (!selSlug || !topic.trim()) { setError('Select a cohort and enter a topic'); return; }
    setUploading(true); setError(''); setMsg('');
    try {
      if (mode === 'text') {
        if (!textContent.trim()) { setError('Content is required'); setUploading(false); return; }
        const r = await api.learningPath.ingestText(selSlug, topic, textContent);
        setMsg(`Stored ${r.chunks_stored} chunks for "${topic}"`);
        setTextContent('');
      } else {
        if (!file) { setError('Select a file'); setUploading(false); return; }
        const r = await api.learningPath.ingestFile(selSlug, topic, file);
        setMsg(`Stored ${r.chunks_stored} chunks from "${file.name}"`);
        setFile(null);
      }
      setTopic('');
      loadCollections(selSlug);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDeleteCol = async (colTopic: string) => {
    if (!confirm(`Delete all content for "${colTopic}"?`)) return;
    setDeleting(colTopic);
    try { await api.learningPath.deleteCollection(selSlug, colTopic); loadCollections(selSlug); }
    catch { alert('Failed to delete'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="tc-section">
      <div className="tc-section-head">
        <h2 className="tc-section-title">Knowledge Base</h2>
        <p className="tc-section-sub">Upload curriculum content per topic. Used for RAG-grounded learning path generation.</p>
      </div>

      {/* Cohort picker */}
      <div className="tc-cohort-picker">
        {cohorts.map(c => (
          <button key={c.slug} className={`tc-cohort-pill ${selSlug === c.slug ? 'tc-cohort-pill--on' : ''}`} onClick={() => setSelSlug(c.slug)}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {selSlug && (
        <>
          {/* Upload form */}
          <div className="tc-form card">
            <h3 className="tc-form-title">Add Content</h3>
            {error && <div className="tc-error">{error}</div>}
            {msg && <div className="tc-success">{msg}</div>}

            <div className="tc-mode-toggle">
              <button className={`tc-mode-btn ${mode === 'text' ? 'tc-mode-btn--on' : ''}`} onClick={() => setMode('text')}>Paste Text</button>
              <button className={`tc-mode-btn ${mode === 'file' ? 'tc-mode-btn--on' : ''}`} onClick={() => setMode('file')}>Upload File</button>
            </div>

            <Field label="Topic Name" hint="e.g. Spring Boot, Docker, SQL Basics">
              <input className="tc-input" placeholder="Topic name" value={topic} onChange={e => setTopic(e.target.value)} />
            </Field>

            {mode === 'text' ? (
              <Field label="Content">
                <textarea className="tc-textarea" rows={6} value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Paste notes, documentation, examples, or lecture content here…" />
              </Field>
            ) : (
              <Field label="File" hint="PDF, MD, TXT, PY, Java, JS, TS">
                <label className="tc-file-label">
                  <FileIcon size={14} /> {file ? file.name : 'Choose file…'}
                  <input type="file" accept=".pdf,.md,.txt,.py,.java,.js,.ts" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
              </Field>
            )}

            <div className="tc-form-actions">
              <button className="tc-btn tc-btn--primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload & Chunk'}
              </button>
            </div>
          </div>

          {/* Existing collections */}
          <div className="tc-collections">
            <div className="tc-collections-head">
              <span className="tc-collections-title">Stored Collections</span>
              <button className="tc-icon-btn" onClick={() => loadCollections(selSlug)} title="Refresh"><RefreshIcon size={13} /></button>
            </div>
            {loadingCols ? (
              <p className="tc-empty">Loading…</p>
            ) : collections.length === 0 ? (
              <p className="tc-empty">No content uploaded yet for this cohort.</p>
            ) : (
              <div className="tc-col-list">
                {collections.map(col => (
                  <div key={col.collection} className="tc-col-row">
                    <div className="tc-col-row__left">
                      <span className="tc-col-row__name">{col.topic}</span>
                      <span className="tc-col-row__count">{col.document_count} chunks</span>
                    </div>
                    <button className="tc-btn tc-btn--danger-ghost tc-btn--sm" onClick={() => handleDeleteCol(col.topic)} disabled={deleting === col.topic}>
                      <TrashIcon size={12} /> {deleting === col.topic ? '…' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Tab: Questions ─────────────────────────────────────────────────────────────
const QuestionsTab: React.FC<{ cohorts: LPCohort[] }> = ({ cohorts }) => {
  const [selSlug, setSelSlug] = useState(cohorts[0]?.slug || '');
  const [cohortDetail, setCohortDetail] = useState<LPCohortDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qType, setQType] = useState<'mcq' | 'text'>('mcq');
  const [qText, setQText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [placeholder, setPlaceholder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async (slug: string) => {
    setLoading(true);
    try { setCohortDetail(await api.learningPath.getCohort(slug)); }
    catch { setCohortDetail(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selSlug) load(selSlug); }, [selSlug]);

  const handleAddQ = async () => {
    if (!qText.trim()) { setError('Question text is required'); return; }
    if (qType === 'mcq' && opts.some(o => !o.trim())) { setError('All 4 options are required for MCQ'); return; }
    setSaving(true); setError('');
    try {
      await api.learningPath.addQuestion(selSlug, {
        type: qType,
        question: qText,
        options: qType === 'mcq' ? opts : undefined,
        correct_index: qType === 'mcq' ? correctIdx : undefined,
        placeholder: qType === 'text' ? placeholder : undefined,
        weight: qType === 'text' ? 0 : 1,
      });
      setAdding(false); setQText(''); setOpts(['', '', '', '']); setPlaceholder('');
      load(selSlug);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to add question');
    } finally { setSaving(false); }
  };

  const handleDeleteQ = async (qid: string) => {
    if (!confirm('Delete this question?')) return;
    setDeleting(qid);
    try { await api.learningPath.deleteQuestion(selSlug, qid); load(selSlug); }
    catch { alert('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const questions: LPAssessmentQuestion[] = cohortDetail?.assessment_questions || [];

  return (
    <div className="tc-section">
      <div className="tc-section-head">
        <h2 className="tc-section-title">Assessment Questions</h2>
        <p className="tc-section-sub">Manage the technical MCQs shown to students during Step 2 of the assessment.</p>
      </div>

      <div className="tc-cohort-picker">
        {cohorts.map(c => (
          <button key={c.slug} className={`tc-cohort-pill ${selSlug === c.slug ? 'tc-cohort-pill--on' : ''}`} onClick={() => setSelSlug(c.slug)}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {selSlug && (
        <>
          <div className="tc-section-head" style={{ marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{questions.length} questions</span>
            <button className="tc-btn tc-btn--primary" onClick={() => setAdding(v => !v)}>
              <PlusIcon size={13} /> Add Question
            </button>
          </div>

          {adding && (
            <div className="tc-form card">
              <h3 className="tc-form-title">New Question</h3>
              {error && <div className="tc-error">{error}</div>}
              <div className="tc-mode-toggle">
                <button className={`tc-mode-btn ${qType === 'mcq' ? 'tc-mode-btn--on' : ''}`} onClick={() => setQType('mcq')}>MCQ</button>
                <button className={`tc-mode-btn ${qType === 'text' ? 'tc-mode-btn--on' : ''}`} onClick={() => setQType('text')}>Open Answer</button>
              </div>
              <Field label="Question">
                <textarea className="tc-textarea" rows={2} value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter your question…" />
              </Field>
              {qType === 'mcq' ? (
                <>
                  <Field label="Options (mark the correct one)">
                    <div className="tc-opts">
                      {opts.map((o, i) => (
                        <div key={i} className="tc-opt-row">
                          <button type="button" className={`tc-opt-mark ${correctIdx === i ? 'tc-opt-mark--on' : ''}`} onClick={() => setCorrectIdx(i)} title="Mark as correct">
                            {String.fromCharCode(65 + i)}
                          </button>
                          <input className="tc-input" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={o} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} />
                        </div>
                      ))}
                    </div>
                  </Field>
                </>
              ) : (
                <Field label="Placeholder text" hint="shown inside the textarea">
                  <input className="tc-input" placeholder="e.g. Describe a project you've built…" value={placeholder} onChange={e => setPlaceholder(e.target.value)} />
                </Field>
              )}
              <div className="tc-form-actions">
                <button className="tc-btn tc-btn--ghost" onClick={() => setAdding(false)}>Cancel</button>
                <button className="tc-btn tc-btn--primary" onClick={handleAddQ} disabled={saving}>
                  {saving ? 'Saving…' : 'Add Question'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="tc-empty">Loading…</p>
          ) : (
            <div className="tc-q-list">
              {questions.map((q, i) => (
                <motion.div key={q.id} className="tc-q-card card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}>
                  <div className="tc-q-card__header">
                    <span className="tc-q-card__num">Q{i + 1}</span>
                    <span className={`tc-q-card__type tc-q-card__type--${q.type}`}>{q.type}</span>
                    {q.weight === 0 && <span className="tc-q-card__info">informational</span>}
                    <button className="tc-icon-btn tc-icon-btn--danger" onClick={() => handleDeleteQ(q.id)} disabled={deleting === q.id}>
                      <TrashIcon size={12} />
                    </button>
                  </div>
                  <p className="tc-q-card__text">{q.question}</p>
                  {q.type === 'mcq' && q.options && (
                    <div className="tc-q-card__opts">
                      {q.options.map((o, oi) => (
                        <span key={oi} className={`tc-q-card__opt ${oi === q.correct_index ? 'tc-q-card__opt--correct' : ''}`}>
                          {String.fromCharCode(65 + oi)}. {o}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.type === 'text' && q.placeholder && (
                    <p className="tc-q-card__placeholder">"{q.placeholder}"</p>
                  )}
                </motion.div>
              ))}
              {questions.length === 0 && <p className="tc-empty">No questions yet. Add your first above.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const TrainerCurriculumPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('cohorts');
  const [cohorts, setCohorts] = useState<LPCohort[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCohorts = async () => {
    setLoading(true);
    try { const r = await api.learningPath.listCohorts(); setCohorts(r.cohorts); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCohorts(); }, []);

  return (
    <div className="tc-page">
      <div className="tc-header">
        <div>
          <h1 className="tc-title">Trainer Portal</h1>
          <p className="tc-sub">Manage cohorts, curriculum content, and assessment questions.</p>
        </div>
        <button className="tc-icon-btn" onClick={loadCohorts} title="Refresh all"><RefreshIcon size={15} /></button>
      </div>

      <div className="tc-tabs">
        <TabBtn active={tab === 'cohorts'} onClick={() => setTab('cohorts')}>Cohorts</TabBtn>
        <TabBtn active={tab === 'content'} onClick={() => setTab('content')}>Knowledge Base</TabBtn>
        <TabBtn active={tab === 'questions'} onClick={() => setTab('questions')}>Assessment Questions</TabBtn>
      </div>

      {loading ? (
        <div className="tc-loading"><span className="lp-spinner" /> Loading…</div>
      ) : (
        <>
          {tab === 'cohorts' && <CohortsTab cohorts={cohorts} onRefresh={loadCohorts} />}
          {tab === 'content' && <ContentTab cohorts={cohorts} />}
          {tab === 'questions' && <QuestionsTab cohorts={cohorts} />}
        </>
      )}
    </div>
  );
};

export default TrainerCurriculumPage;
