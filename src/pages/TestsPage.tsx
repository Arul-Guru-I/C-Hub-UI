import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type {
  GeneratedTest,
  SubmitTestResponse,
  TestHistoryEntry,
  QuestionResult,
  CollectionInfo,
} from '../services/api';
import { CheckIcon, XIcon, ClockIcon, ArrowUpIcon, FileIcon, TrashIcon, RefreshIcon } from '../components/ui/Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './TestsPage.css';

type Phase = 'setup' | 'generating' | 'quiz' | 'submitting' | 'results';

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function difficultyColor(d: string) {
  if (d === 'easy') return 'var(--color-success)';
  if (d === 'medium') return 'var(--color-warning)';
  return 'var(--color-danger)';
}

// ── HistoryTab ───────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{ entries: TestHistoryEntry[]; loading: boolean }> = ({ entries, loading }) => {
  if (loading) return <div className="tests-empty">Loading history…</div>;
  if (entries.length === 0) return <div className="tests-empty">No quiz attempts yet. Take a test to get started!</div>;

  return (
    <div className="quiz-history">
      {entries.map((e, i) => (
        <div key={e.test_id ?? i} className="history-card card anim-fade-up">
          <div className="history-card__left">
            <span className="history-card__topic">{e.topic}</span>
          </div>
          <div className="history-card__center">
            <span className="history-card__score" style={{ color: scoreColor(e.score) }}>
              {e.score}%
            </span>
            <span className="history-card__fraction">{e.correct_count}/{e.total} correct</span>
          </div>
          <div className="history-card__right">
            {e.submitted_at && (
              <span className="history-card__date">
                <ClockIcon size={11} />
                {new Date(e.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TOPICS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "FastAPI",
  "SQL & Databases",
  "Git & Version Control",
  "Docker & Containers",
  "REST APIs",
  "Data Structures & Algorithms",
  "System Design",
  "HTML & CSS",
  "Node.js",
  "MongoDB",
  "Linux & Shell",
  "Springboot Microservices",
  "AWS",
  "Jenkins",
];

// ── TestsPage ────────────────────────────────────────────────────────────────

const TestsPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'quiz' | 'history' | 'knowledge'>('quiz');

  // setup
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [difficulties, setDifficulties] = useState<string[]>(["easy", "medium", "hard"]);
  const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPICS[0]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [topicsError] = useState('');

  // quiz flow
  const [phase, setPhase] = useState<Phase>('setup');
  const [currentTest, setCurrentTest] = useState<GeneratedTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<SubmitTestResponse | null>(null);
  const [quizError, setQuizError] = useState('');

  // history
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // trainer lookup
  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';
  const [targetUserId, setTargetUserId] = useState('');
  const [trainerHistory, setTrainerHistory] = useState<TestHistoryEntry[]>([]);
  const [trainerHistoryLoading, setTrainerHistoryLoading] = useState(false);

  // knowledge base (trainer)
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [ingestTopic, setIngestTopic] = useState('');
  const [ingestSource, setIngestSource] = useState('manual');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<string | null>(null);

  // pre-generation (trainer)
  const [pregenTopic, setPregenTopic] = useState('');
  const [pregenDifficulty, setPregenDifficulty] = useState('medium');
  const [pregenPoolSize, setPregenPoolSize] = useState(30);
  const [pregenLoading, setPregenLoading] = useState(false);
  const [pregenMessage, setPregenMessage] = useState('');

  useEffect(() => {
    api.tests.getTopics()
      .then(data => {
        if (data.topics?.length) {
          setTopics(data.topics);
          setSelectedTopic(data.topics[0]);
        }
        if (data.difficulties?.length) setDifficulties(data.difficulties);
      })
      .catch(() => { /* keep DEFAULT_TOPICS */ });
  }, []);

  const fetchCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const res = await api.tests.getCollections();
      setCollections(res.collections ?? []);
    } catch {
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'knowledge' && isTrainer) {
      fetchCollections();
    }
  }, [activeTab, isTrainer, fetchCollections]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryLoading(true);
    api.tests.getMyResults()
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab]);

  const handleGenerate = async () => {
    if (!selectedTopic || !selectedDifficulty) return;
    setPhase('generating');
    setQuizError('');
    try {
      const test = await api.tests.generateTest(selectedTopic, selectedDifficulty, numQuestions);
      setCurrentTest(test);
      setAnswers({});
      setPhase('quiz');
    } catch (err: any) {
      setQuizError(err?.response?.data?.detail ?? 'Failed to generate test. Please try again.');
      setPhase('setup');
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const answeredCount = currentTest ? Object.keys(answers).length : 0;
  const totalQuestions = currentTest?.questions.length ?? 0;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const handleSubmit = async () => {
    if (!currentTest || !allAnswered) return;
    setPhase('submitting');
    setQuizError('');
    try {
      const payload = Object.entries(answers).map(([question_id, selected_option]) => ({
        question_id,
        selected_option,
      }));
      const res = await api.tests.submitTest(currentTest.test_id, payload);
      setResults(res);
      setPhase('results');
    } catch (err: any) {
      setQuizError(err?.response?.data?.detail ?? 'Failed to submit answers. Please try again.');
      setPhase('quiz');
    }
  };

  const handleReset = () => {
    setPhase('setup');
    setCurrentTest(null);
    setAnswers({});
    setResults(null);
    setQuizError('');
  };

  const fetchTrainerHistory = useCallback(async () => {
    if (!targetUserId.trim()) return;
    setTrainerHistoryLoading(true);
    try {
      const data = await api.tests.getUserResults(targetUserId.trim());
      setTrainerHistory(Array.isArray(data) ? data : []);
    } catch {
      setTrainerHistory([]);
    } finally {
      setTrainerHistoryLoading(false);
    }
  }, [targetUserId]);

  const handleIngest = async () => {
    if (!ingestTopic.trim()) return;
    setIngestLoading(true);
    setIngestMessage('');
    try {
      let content = ingestContent;
      let source = ingestSource;
      if (ingestFile) {
        content = await ingestFile.text();
        source = ingestFile.name;
      }
      if (!content.trim()) return;
      const res = await api.tests.ingestTopic({ topic: ingestTopic, content, source });
      setIngestMessage(res.message);
      setIngestTopic('');
      setIngestContent('');
      setIngestFile(null);
      fetchCollections();
    } catch (err: any) {
      setIngestMessage(err?.response?.data?.detail ?? 'Failed to ingest content.');
    } finally {
      setIngestLoading(false);
    }
  };

  const handlePregen = async () => {
    if (!pregenTopic) return;
    setPregenLoading(true);
    setPregenMessage('');
    try {
      const res = await api.tests.pregenTopic({ topic: pregenTopic, difficulty: pregenDifficulty, pool_size: pregenPoolSize });
      setPregenMessage(res.message);
    } catch (err: any) {
      setPregenMessage(err?.response?.data?.detail ?? 'Pre-generation failed.');
    } finally {
      setPregenLoading(false);
    }
  };

  const getTopicDisplayName = (colName: string) => {
    return topics.find(t => 
      t.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_').replace(/\//g, '_') === colName
    ) || colName;
  };

  const handleDeleteCollection = async (collectionName: string) => {
    const originalTopic = getTopicDisplayName(collectionName);
    setDeletingCollection(collectionName);
    try {
      await api.tests.deleteCollection(originalTopic);
      fetchCollections();
    } catch {
      // silently refresh — collection may already be gone
      fetchCollections();
    } finally {
      setDeletingCollection(null);
    }
  };

  return (
    <div className="page-content tests-page">
      <div className="page-header">
        <h1>Knowledge Tests</h1>
        <p>Test your understanding with AI-generated multiple choice quizzes.</p>
      </div>

      {/* Tabs */}
      <div className="quiz-tabs">
        <button
          className={`quiz-tab ${activeTab === 'quiz' ? 'quiz-tab--active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          Take a Test
        </button>
        <button
          className={`quiz-tab ${activeTab === 'history' ? 'quiz-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          My Results
        </button>
        {isTrainer && (
          <button
            className={`quiz-tab ${activeTab === 'knowledge' ? 'quiz-tab--active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            Knowledge Base
          </button>
        )}
      </div>

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div>
          <HistoryTab entries={history} loading={historyLoading} />

          {isTrainer && (
            <div className="trainer-lookup card" style={{ marginTop: '24px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                View Learner History
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: '200px' }}
                  placeholder="User ID…"
                  value={targetUserId}
                  onChange={e => setTargetUserId(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={fetchTrainerHistory}
                  disabled={!targetUserId.trim() || trainerHistoryLoading}
                >
                  {trainerHistoryLoading ? 'Loading…' : 'Look up'}
                </button>
              </div>
              {trainerHistory.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <HistoryTab entries={trainerHistory} loading={false} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* KNOWLEDGE TAB */}
      {activeTab === 'knowledge' && isTrainer && (
        <div className="knowledge-tab anim-fade-up">
          <div className="card knowledge-card" style={{ marginBottom: '24px' }}>
            <div className="knowledge-card__header">
              <div className="knowledge-card__icon-wrap">
                <ArrowUpIcon size={20} color="var(--color-primary-light)" />
              </div>
              <div>
                <h2 className="knowledge-card__title">Upload Curriculum</h2>
                <p className="knowledge-card__desc">
                  Add teaching materials to ground AI test generation using RAG.
                </p>
              </div>
            </div>

            <div className="knowledge-form grid-2">
              <div className="form-group">
                <label>Topic</label>
                <select
                  className="form-input kb-input"
                  value={ingestTopic}
                  onChange={e => setIngestTopic(e.target.value)}
                >
                  <option value="">Select a topic…</option>
                  {DEFAULT_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Source Type</label>
                <select className="form-input kb-input" value={ingestSource} onChange={e => setIngestSource(e.target.value)}>
                  <option value="manual">Manual Entry / Paste</option>
                  <option value="document">Document Copy</option>
                  <option value="documentation">Official Documentation</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Curriculum Content (Draft)</label>
              <textarea
                className="form-input kb-textarea"
                rows={6}
                placeholder="Paste curriculum text here..."
                value={ingestContent}
                onChange={e => { setIngestContent(e.target.value); setIngestFile(null); }}
              />
            </div>

            <div className="kb-file-upload">
              <div className="kb-file-upload__content">
                <FileIcon size={24} color="var(--color-text-muted)" />
                <div className="kb-file-upload__text">
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Or upload a file directly</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>(TXT or Markdown — replaces pasted text)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  Choose File
                  <input
                    type="file"
                    accept=".txt,.md,.markdown"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setIngestFile(f);
                      if (f) setIngestContent('');
                      e.target.value = '';
                    }}
                  />
                </label>
                {ingestFile && (
                  <span className="kb-selected-file">
                    <FileIcon size={14} color="var(--color-primary-light)" />
                    {ingestFile.name}
                    <button
                      type="button"
                      className="kb-remove-file"
                      onClick={() => setIngestFile(null)}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="kb-action-bar">
              {ingestMessage && (
                <div className="kb-msg kb-msg--success">
                  <CheckIcon size={14} /> {ingestMessage}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleIngest}
                disabled={ingestLoading || !ingestTopic.trim() || (!ingestContent.trim() && !ingestFile)}
                style={{ marginLeft: 'auto' }}
              >
                {ingestLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="quiz-loading__spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Ingesting...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowUpIcon size={14} /> Upload to Knowledge Base
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="card knowledge-card">
            <div className="knowledge-card__header" style={{ marginBottom: '16px' }}>
              <div className="knowledge-card__icon-wrap" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
                <FileIcon size={20} color="var(--color-gold)" />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="knowledge-card__title">Active RAG Collections</h2>
                  <p className="knowledge-card__desc">Currently indexed topics for test generation.</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchCollections} title="Refresh Collections">
                  <RefreshIcon size={14} />
                </button>
              </div>
            </div>

            {collectionsLoading ? (
              <div className="kb-loading">Loading collections...</div>
            ) : collections.length === 0 ? (
              <div className="kb-empty">No embedded collections found in ChromaDB.</div>
            ) : (
              <div className="kb-collections-grid">
                {collections.map(c => (
                  <div key={c.collection} className="kb-collection-card anim-fade-up">
                    <div className="kb-collection-card__info">
                      <h3 className="kb-collection-card__name">{getTopicDisplayName(c.collection)}</h3>
                      <span className="badge badge-info">{c.document_count} chunks</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm kb-collection-card__del"
                      disabled={deletingCollection === c.collection}
                      onClick={() => handleDeleteCollection(c.collection)}
                      title="Delete Collection"
                    >
                      {deletingCollection === c.collection ? (
                        <div className="quiz-loading__spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'var(--color-danger)' }} />
                      ) : (
                        <TrashIcon size={15} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card knowledge-card">
            <div className="knowledge-card__header" style={{ marginBottom: '16px' }}>
              <div className="knowledge-card__icon-wrap">
                <ArrowUpIcon size={20} color="var(--color-primary-light)" />
              </div>
              <div>
                <h2 className="knowledge-card__title">Pre-generate Question Bank</h2>
                <p className="knowledge-card__desc">Bulk-generate and store questions so tests load instantly from the bank.</p>
              </div>
            </div>

            <div className="knowledge-form grid-2">
              <div className="form-group">
                <label>Topic</label>
                <select className="form-input kb-input" value={pregenTopic} onChange={e => setPregenTopic(e.target.value)}>
                  <option value="">Select a topic…</option>
                  {DEFAULT_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <select className="form-input kb-input" value={pregenDifficulty} onChange={e => setPregenDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Pool Size ({pregenPoolSize} questions)</label>
              <input type="range" min={10} max={50} value={pregenPoolSize} onChange={e => setPregenPoolSize(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                <span>10</span><span>50</span>
              </div>
            </div>

            <div className="kb-action-bar">
              {pregenMessage && (
                <div className="kb-msg kb-msg--success">
                  <CheckIcon size={14} /> {pregenMessage}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handlePregen}
                disabled={pregenLoading || !pregenTopic}
                style={{ marginLeft: 'auto' }}
              >
                {pregenLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="quiz-loading__spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…
                  </span>
                ) : 'Generate Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUIZ TAB */}
      {activeTab === 'quiz' && (
        <>
          {/* SETUP */}
          {phase === 'setup' && (
            <div className="quiz-setup card anim-fade-up">
              <h2 className="quiz-setup__title">Configure Your Quiz</h2>
              {topicsError && <div className="login-error">{topicsError}</div>}
              {quizError && <div className="login-error">{quizError}</div>}

              <div className="form-group">
                <label>Topic</label>
                <select
                  className="form-input quiz-select"
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                >
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <div className="difficulty-pills">
                  {difficulties.map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`difficulty-pill ${selectedDifficulty === d ? 'difficulty-pill--active' : ''}`}
                      style={selectedDifficulty === d ? { borderColor: difficultyColor(d), color: difficultyColor(d) } : {}}
                      onClick={() => setSelectedDifficulty(d)}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Number of Questions ({numQuestions})</label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  <span>3</span><span>15</span>
                </div>
              </div>

              <button
                className="btn btn-primary"
                disabled={!selectedTopic || !selectedDifficulty || topics.length === 0}
                onClick={handleGenerate}
                style={{ marginTop: '8px', alignSelf: 'flex-start' }}
              >
                Generate Test
              </button>
            </div>
          )}

          {/* GENERATING */}
          {phase === 'generating' && (
            <div className="quiz-loading card anim-fade-up">
              <div className="quiz-loading__spinner" />
              <p>Generating your quiz with AI…</p>
            </div>
          )}

          {/* QUIZ */}
          {phase === 'quiz' && currentTest && (
            <div className="quiz-active anim-fade-up">
              <div className="quiz-active__header card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="quiz-active__topic">{currentTest.topic}</span>
                    <span className="quiz-active__difficulty" style={{ color: difficultyColor(currentTest.difficulty) }}>
                      {currentTest.difficulty}
                    </span>
                    {currentTest.source && (
                      <span style={{ background: currentTest.source === 'bank' ? 'var(--color-success)' : 'var(--color-primary)', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        {currentTest.source === 'bank' ? 'From Bank' : currentTest.source === 'rag' ? 'RAG Grounded' : 'AI Generated'}
                      </span>
                    )}
                  </div>
                  <span className="quiz-active__progress-text">
                    {answeredCount} / {totalQuestions} answered
                  </span>
                </div>
                <div className="quiz-progress-bar">
                  <div
                    className="quiz-progress-bar__fill"
                    style={{ width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {currentTest.questions.map((q, qi) => {
                const chosen = answers[q.id];
                return (
                  <div key={q.id} className="question-card card anim-fade-up" style={{ marginBottom: '14px', padding: '20px 24px' }}>
                    <p className="question-card__num">Question {qi + 1}</p>
                    <p className="question-card__text">{q.question}</p>
                    <div className="question-options">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          className={`option-btn ${chosen === oi ? 'option-btn--selected' : ''}`}
                          onClick={() => handleSelectOption(q.id, oi)}
                        >
                          <span className="option-btn__letter">{String.fromCharCode(65 + oi)}</span>
                          <span className="option-btn__text">{opt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {quizError && <div className="login-error" style={{ marginBottom: '12px' }}>{quizError}</div>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={handleReset}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={!allAnswered}
                  onClick={handleSubmit}
                >
                  Submit Answers
                </button>
              </div>
            </div>
          )}

          {/* SUBMITTING */}
          {phase === 'submitting' && (
            <div className="quiz-loading card anim-fade-up">
              <div className="quiz-loading__spinner" />
              <p>Grading your answers…</p>
            </div>
          )}

          {/* RESULTS */}
          {phase === 'results' && results && currentTest && (
            <div className="quiz-results anim-fade-up">
              <div className="results-score-card card" style={{ marginBottom: '20px', padding: '28px 24px', textAlign: 'center' }}>
                <div className="results-score-card__score" style={{ color: scoreColor(results.score) }}>
                  {results.score}%
                </div>
                <div className="results-score-card__fraction">
                  {results.correct_count} out of {results.total} correct
                </div>
                <div className="results-score-card__meta">
                  {currentTest.topic} ·{' '}
                  <span style={{ color: difficultyColor(currentTest.difficulty) }}>{currentTest.difficulty}</span>
                </div>
                <div className="results-bar" style={{ margin: '16px auto 0', maxWidth: '240px' }}>
                  <div
                    className="results-bar__fill"
                    style={{ width: `${results.score}%`, background: scoreColor(results.score) }}
                  />
                </div>
              </div>

              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                Question Breakdown
              </h3>

              {results.topic_performance && results.topic_performance.length > 0 && (
                <div className="card anim-fade-up" style={{ marginBottom: '24px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>
                    Your Historical Performance
                  </h3>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer>
                      <BarChart data={results.topic_performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="topic" stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip 
                          cursor={{ fill: 'var(--color-bg-tertiary)' }}
                          contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                        />
                        <Bar dataKey="average_score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Average Score %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {results.results.map((r: QuestionResult, i: number) => (
                <div
                  key={r.question_id ?? i}
                  className={`result-item card anim-fade-up ${r.correct ? 'result-item--correct' : 'result-item--wrong'}`}
                  style={{ marginBottom: '12px', padding: '18px 20px' }}
                >
                  <div className="result-item__header">
                    <span className={`result-item__icon ${r.correct ? 'result-item__icon--correct' : 'result-item__icon--wrong'}`}>
                      {r.correct ? <CheckIcon size={15} /> : <XIcon size={15} />}
                    </span>
                    <span className="result-item__qnum">Q{i + 1}</span>
                    <span className="result-item__question">{r.question}</span>
                  </div>
                  <div className="result-item__answers">
                    <span className={`result-item__answer ${r.correct ? 'result-item__answer--correct' : 'result-item__answer--wrong'}`}>
                      Your answer: Option {String.fromCharCode(65 + r.selected_option)}
                    </span>
                    {!r.correct && (
                      <span className="result-item__answer result-item__answer--correct">
                        Correct: Option {String.fromCharCode(65 + r.correct_option)}
                      </span>
                    )}
                  </div>
                  {r.explanation && (
                    <div className="result-item__explanation">{r.explanation}</div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={handleReset}>
                  Take Another Test
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TestsPage;
