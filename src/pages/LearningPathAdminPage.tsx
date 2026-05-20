import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import type { LPCohort, LPCohortDetail, LPAssessmentQuestion } from '../services/api';
import { PlusIcon, TrashIcon, RefreshIcon, FileIcon, TagIcon } from '../components/ui/Icons';
import './LearningPathAdminPage.css';

type Tab = 'cohorts' | 'topics' | 'questions';

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

// ── Tab: Topics (Global Topic Library + Cohort Linking) ──────────────────────
const TopicsTab: React.FC<{ cohorts: LPCohort[] }> = ({ cohorts }) => {

  // ── Library state ──
  type LPTopicLocal = { slug: string; name: string; collection: string; chunk_count: number };
  const [topics, setTopics] = useState<LPTopicLocal[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formTopic, setFormTopic] = useState('');
  const [formMode, setFormMode] = useState<'text' | 'file'>('text');
  const [formContent, setFormContent] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formReplace, setFormReplace] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);
  const [libMsg, setLibMsg] = useState('');
  const [libErr, setLibErr] = useState('');

  // ── Cohort-link state ──
  const [selSlug, setSelSlug] = useState(cohorts[0]?.slug || '');
  const [linkedSlugs, setLinkedSlugs] = useState<string[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linking, setLinking] = useState(false);
  const [toLink, setToLink] = useState('');

  const loadTopics = async () => {
    setLoadingTopics(true);
    try { const r = await api.learningPath.listTopics(); setTopics(r.topics); }
    catch { setTopics([]); }
    finally { setLoadingTopics(false); }
  };

  const loadLinks = async (slug: string) => {
    setLoadingLinks(true);
    try { const r = await api.learningPath.getLinkedTopics(slug); setLinkedSlugs(r.linked_topics); }
    catch { setLinkedSlugs([]); }
    finally { setLoadingLinks(false); }
  };

  useEffect(() => { loadTopics(); }, []);
  useEffect(() => { if (selSlug) loadLinks(selSlug); }, [selSlug]);

  const handleUpload = async () => {
    if (!formTopic.trim()) { setLibErr('Topic name is required'); return; }
    setUploading(true); setLibErr(''); setLibMsg('');
    try {
      let r: { chunks_stored: number };
      if (formMode === 'text') {
        if (!formContent.trim()) { setLibErr('Content is required'); setUploading(false); return; }
        r = await api.learningPath.topicIngestText(formTopic, formContent, 'manual', formReplace);
        setFormContent('');
      } else {
        if (!formFile) { setLibErr('Choose a file'); setUploading(false); return; }
        r = await api.learningPath.topicIngestFile(formTopic, formFile, formReplace);
        setFormFile(null);
      }
      setLibMsg(`${formReplace ? 'Replaced' : 'Added'} ${r.chunks_stored} chunks for "${formTopic}"`);
      setFormTopic(''); setFormReplace(false); setShowForm(false);
      loadTopics();
    } catch (e: any) {
      setLibErr(e?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDeleteTopic = async (slug: string, name: string) => {
    if (!confirm(`Delete topic "${name}"? It will be unlinked from all cohorts.`)) return;
    setDeletingTopic(slug);
    try {
      await api.learningPath.deleteTopic(slug);
      setTopics(prev => prev.filter(t => t.slug !== slug));
      setLinkedSlugs(prev => prev.filter(s => s !== slug));
    } catch { alert('Failed to delete topic'); }
    finally { setDeletingTopic(null); }
  };

  const handleLink = async () => {
    if (!toLink || linkedSlugs.includes(toLink)) return;
    setLinking(true);
    try {
      await api.learningPath.linkTopic(selSlug, toLink);
      setLinkedSlugs(prev => [...prev, toLink]);
      setToLink('');
    } catch { alert('Failed to link topic'); }
    finally { setLinking(false); }
  };

  const handleUnlink = async (topicSlug: string) => {
    try {
      await api.learningPath.unlinkTopic(selSlug, topicSlug);
      setLinkedSlugs(prev => prev.filter(s => s !== topicSlug));
    } catch { alert('Failed to unlink topic'); }
  };

  const unlinkedTopics = topics.filter(t => !linkedSlugs.includes(t.slug));

  return (
    <div className="tc-section">

      {/* ── Section 1: Global Topic Library ── */}
      <div className="tc-section-head">
        <div>
          <h2 className="tc-section-title">Topic Library</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="tc-icon-btn" onClick={loadTopics} title="Refresh"><RefreshIcon size={13} /></button>
          <button className="tc-btn tc-btn--primary" onClick={() => { setShowForm(v => !v); setLibErr(''); setLibMsg(''); }}>
            <PlusIcon size={13} /> New Topic
          </button>
        </div>
      </div>

      {showForm && (
        <div className="tc-form card">
          <h3 className="tc-form-title">{formReplace ? 'Replace Topic Content' : 'Add Topic Content'}</h3>
          {libErr && <div className="tc-error">{libErr}</div>}
          {libMsg && <div className="tc-success">{libMsg}</div>}

          <Field label="Topic Name" hint="e.g. Spring Boot, Docker, SQL Basics">
            <input className="tc-input" placeholder="Topic name" value={formTopic} onChange={e => setFormTopic(e.target.value)} />
          </Field>

          <div className="tc-mode-toggle">
            <button className={`tc-mode-btn ${formMode === 'text' ? 'tc-mode-btn--on' : ''}`} onClick={() => setFormMode('text')}>Paste Text</button>
            <button className={`tc-mode-btn ${formMode === 'file' ? 'tc-mode-btn--on' : ''}`} onClick={() => setFormMode('file')}>Upload File</button>
          </div>

          {formMode === 'text' ? (
            <Field label="Content">
              <textarea className="tc-textarea" rows={6} value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Paste notes, documentation, or lecture content here…" />
            </Field>
          ) : (
            <Field label="File" hint="PDF, MD, TXT, PY, Java, JS, TS">
              <label className="tc-file-label">
                <FileIcon size={14} /> {formFile ? formFile.name : 'Choose file…'}
                <input type="file" accept=".pdf,.md,.txt,.py,.java,.js,.ts" style={{ display: 'none' }} onChange={e => setFormFile(e.target.files?.[0] || null)} />
              </label>
            </Field>
          )}

          <label className="tc-replace-toggle">
            <input type="checkbox" checked={formReplace} onChange={e => setFormReplace(e.target.checked)} />
            <span>Replace existing chunks</span>
            <span className="tc-hint"> — clears old content first, then re-embeds</span>
          </label>

          <div className="tc-form-actions">
            <button className="tc-btn tc-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="tc-btn tc-btn--primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : formReplace ? 'Replace & Chunk' : 'Upload & Chunk'}
            </button>
          </div>
        </div>
      )}

      {libMsg && !showForm && <div className="tc-success" style={{ marginBottom: 12 }}>{libMsg}</div>}

      <div className="tc-col-list">
        {loadingTopics ? (
          <p className="tc-empty">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="tc-empty">No topics yet. Create your first one above.</p>
        ) : (
          topics.map(t => (
            <div key={t.slug} className="tc-col-row">
              <div className="tc-col-row__left">
                <TagIcon size={13} color="var(--color-primary-light)" />
                <span className="tc-col-row__name">{t.name}</span>
                <span className="tc-col-row__count">{t.chunk_count} chunks</span>
                <code style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.collection}</code>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="tc-btn tc-btn--ghost tc-btn--sm" onClick={() => { setFormTopic(t.name); setFormReplace(true); setShowForm(true); setLibMsg(''); setLibErr(''); }}>
                  Update
                </button>
                <button className="tc-btn tc-btn--danger-ghost tc-btn--sm" onClick={() => handleDeleteTopic(t.slug, t.name)} disabled={deletingTopic === t.slug}>
                  <TrashIcon size={12} /> {deletingTopic === t.slug ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Section 2: Cohort Links ── */}
      <div className="tc-section-head" style={{ marginTop: 32 }}>
        <div>
          <h2 className="tc-section-title">Cohort Links</h2>
          <p className="tc-section-sub">Choose which topics each cohort uses for RAG-grounded learning path generation.</p>
        </div>
      </div>

      <div className="tc-cohort-picker">
        {cohorts.map(c => (
          <button key={c.slug} className={`tc-cohort-pill ${selSlug === c.slug ? 'tc-cohort-pill--on' : ''}`} onClick={() => setSelSlug(c.slug)}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {selSlug && (
        <div className="tc-form card">
          <h3 className="tc-form-title" style={{ marginBottom: 12 }}>Linked Topics for this Cohort</h3>

          {loadingLinks ? (
            <p className="tc-empty">Loading…</p>
          ) : linkedSlugs.length === 0 ? (
            <p className="tc-empty">No topics linked yet.</p>
          ) : (
            <div className="tc-col-list" style={{ marginBottom: 16 }}>
              {linkedSlugs.map(slug => {
                const t = topics.find(x => x.slug === slug);
                return (
                  <div key={slug} className="tc-col-row">
                    <div className="tc-col-row__left">
                      <TagIcon size={13} color="var(--color-success)" />
                      <span className="tc-col-row__name">{t?.name || slug}</span>
                      {t && <span className="tc-col-row__count">{t.chunk_count} chunks</span>}
                    </div>
                    <button className="tc-btn tc-btn--danger-ghost tc-btn--sm" onClick={() => handleUnlink(slug)}>
                      Unlink
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="tc-input"
              value={toLink}
              onChange={e => setToLink(e.target.value)}
              style={{ flex: 1 }}
              disabled={unlinkedTopics.length === 0}
            >
              <option value="">{unlinkedTopics.length === 0 ? 'All topics already linked' : 'Select a topic to link…'}</option>
              {unlinkedTopics.map(t => (
                <option key={t.slug} value={t.slug}>{t.name} ({t.chunk_count} chunks)</option>
              ))}
            </select>
            <button className="tc-btn tc-btn--primary" onClick={handleLink} disabled={!toLink || linking}>
              {linking ? 'Linking…' : 'Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Assessment Questions ─────────────────────────────────────────────────
const AssessmentQuestionsTab: React.FC<{ cohorts: LPCohort[] }> = ({ cohorts }) => {
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
const LearningPathAdminPage: React.FC = () => {
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
          <h1 className="tc-title">Learning Path Admin</h1>
          <p className="tc-sub">Manage cohorts, LP knowledge base content, and assessment questions. Backed by <code>learning_path.py</code>.</p>
        </div>
        <button className="tc-icon-btn" onClick={loadCohorts} title="Refresh all"><RefreshIcon size={15} /></button>
      </div>

      <div className="tc-tabs">
        <TabBtn active={tab === 'cohorts'} onClick={() => setTab('cohorts')}>Cohorts</TabBtn>
        <TabBtn active={tab === 'topics'} onClick={() => setTab('topics')}>Topics</TabBtn>
        <TabBtn active={tab === 'questions'} onClick={() => setTab('questions')}>Assessment Questions</TabBtn>
      </div>

      {loading ? (
        <div className="tc-loading"><span className="lp-spinner" /> Loading…</div>
      ) : (
        <>
          {tab === 'cohorts' && <CohortsTab cohorts={cohorts} onRefresh={loadCohorts} />}
          {tab === 'topics' && <TopicsTab cohorts={cohorts} />}
          {tab === 'questions' && <AssessmentQuestionsTab cohorts={cohorts} />}
        </>
      )}
    </div>
  );
};

export default LearningPathAdminPage;
