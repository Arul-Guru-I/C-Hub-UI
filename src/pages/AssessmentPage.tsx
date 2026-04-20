import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type {
  LPCohortDetail,
  MCQAnswer,
  RoundAnswerSet,
  GenerateQuestionsResponse,
  AssessmentRoundQuestion,
} from '../services/api';
import './AssessmentPage.css';

// ── Step definitions ──────────────────────────────────────────────────────────
// 0=AboutYou  1=Round1  2=Round2  3=Round3  4=Goals  5=Schedule  6=Generate
const STEPS = ['About You', 'Round 1', 'Round 2', 'Round 3', 'Goals', 'Schedule', 'Generate'];
const TOTAL_STEPS = STEPS.length;

const EDUCATION_OPTIONS = ['High School', 'Diploma / Vocational', 'B.Tech / B.E.', 'B.Sc / B.A.', 'M.Tech / M.E.', 'MBA / MCA', 'Ph.D', 'Self-taught', 'Other'];
const ROLE_OPTIONS = ['Student', 'Fresher (0-1 yr)', 'Junior Developer', 'Mid-level Developer', 'Senior Developer', 'QA / Tester', 'DevOps Engineer', 'Data Analyst', 'Manager / Lead', 'Other'];
const LANG_OPTIONS = ['Python', 'Java', 'JavaScript', 'TypeScript', 'C/C++', 'SQL', 'Go', 'Ruby', 'PHP', 'Rust', 'Bash/Shell', 'None'];
const TOOL_OPTIONS = ['Git', 'Docker', 'Linux', 'AWS', 'React', 'Node.js', 'Spring Boot', 'FastAPI', 'Jenkins', 'Kubernetes', 'Terraform', 'PostgreSQL', 'MongoDB', 'Redis', 'None'];
const PROJECT_TYPES = ['Web App', 'REST API', 'Mobile App', 'Data Pipeline', 'CLI Tool', 'Machine Learning / AI', 'DevOps / CI-CD', 'Database Design', 'Automation Script', 'System Design'];
const PROFICIENCY_LEVELS = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Basic syntax, simple scripts' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Can build real features' },
  { value: 'advanced',     label: 'Advanced',     desc: 'Deep knowledge, production code' },
];
const STYLE_OPTIONS = [
  { value: 'visual',   label: '🎥  Visual',   sub: 'Videos, diagrams & demos' },
  { value: 'hands-on', label: '💻  Hands-on', sub: 'Build projects, then learn' },
  { value: 'reading',  label: '📖  Reading',  sub: 'Docs, articles & books' },
  { value: 'mixed',    label: '🔀  Mixed',    sub: 'A bit of everything' },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.2 } }),
};

// ── Small reusable components ─────────────────────────────────────────────────
const Tag: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <button type="button" className={`assess-tag ${selected ? 'assess-tag--on' : ''}`} onClick={onClick}>{label}</button>
);

const MCQCard: React.FC<{
  q: AssessmentRoundQuestion;
  idx: number;
  selected: number | undefined;
  onSelect: (val: number) => void;
  showFeedback?: boolean;
}> = ({ q, idx, selected, onSelect, showFeedback = false }) => (
  <div className={`assess-mcq-card ${showFeedback && selected !== undefined ? 'assess-mcq-card--answered' : ''}`}>
    <p className="assess-mcq-q">
      <span className="assess-mcq-num">Q{idx + 1}.</span> {q.question}
      {q.topic && <span className="assess-mcq-topic-badge">{q.topic}</span>}
    </p>
    <div className="assess-mcq-options">
      {q.options.map((opt, oi) => (
        <button
          key={oi}
          type="button"
          className={`assess-mcq-opt ${selected === oi ? 'assess-mcq-opt--selected' : ''}`}
          onClick={() => onSelect(oi)}
          disabled={showFeedback}
        >
          <span className="assess-mcq-opt__letter">{String.fromCharCode(65 + oi)}</span>
          <span>{opt}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── Score card shown between rounds ──────────────────────────────────────────
const RoundScoreCard: React.FC<{
  roundNum: number;
  score: { correct: number; total: number; percentage: number; weak_areas: string[] } | null;
  nextRoundTitle: string;
  onContinue: () => void;
  loading: boolean;
}> = ({ roundNum, score, nextRoundTitle, onContinue, loading }) => {
  const pct = score?.percentage ?? 0;
  const badge = pct >= 70 ? 'strong' : pct >= 40 ? 'mid' : 'weak';
  const labels: Record<string, string> = { strong: 'Strong', mid: 'Developing', weak: 'Needs Work' };

  return (
    <div className="assess-score-card">
      <div className={`assess-score-circle assess-score-circle--${badge}`}>
        <span className="assess-score-pct">{pct}%</span>
        <span className="assess-score-label">{labels[badge]}</span>
      </div>
      <div className="assess-score-detail">
        <h3>Round {roundNum} Complete</h3>
        <p>{score?.correct ?? 0} of {score?.total ?? 0} correct</p>
        {(score?.weak_areas?.length ?? 0) > 0 && (
          <div className="assess-score-gaps">
            <span className="assess-score-gaps-label">Knowledge gaps identified:</span>
            <div className="assess-score-gaps-list">
              {score!.weak_areas.map(w => <span key={w} className="assess-gap-chip">{w}</span>)}
            </div>
            <p className="assess-score-gaps-note">Round {roundNum + 1} will target these areas.</p>
          </div>
        )}
        {(score?.weak_areas?.length ?? 0) === 0 && (
          <p className="assess-score-excellent">Excellent! No significant gaps — Round {roundNum + 1} will assess advanced topics.</p>
        )}
      </div>
      <button className="assess-continue-btn" onClick={onContinue} disabled={loading}>
        {loading
          ? <><span className="lp-spinner" /> Generating {nextRoundTitle}…</>
          : `Continue to ${nextRoundTitle} →`}
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AssessmentPage: React.FC = () => {
  const { cohortSlug } = useParams<{ cohortSlug: string }>();
  const navigate = useNavigate();

  const [cohort, setCohort] = useState<LPCohortDetail | null>(null);
  const [loadingCohort, setLoadingCohort] = useState(true);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 0 — About You
  const [role, setRole] = useState('');
  const [expYears, setExpYears] = useState(0);
  const [education, setEducation] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [langLevels, setLangLevels] = useState<Record<string, string>>({});
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [projectDescription, setProjectDescription] = useState('');

  // Rounds 1-3 — each has: loading, data, answers, score, showScore
  type RoundState = {
    loading: boolean;
    data: GenerateQuestionsResponse | null;
    answers: Record<string, number>;
    score: GenerateQuestionsResponse['previous_round_score'];
    showScore: boolean;
  };
  const [rounds, setRounds] = useState<RoundState[]>([
    { loading: false, data: null, answers: {}, score: null, showScore: false },
    { loading: false, data: null, answers: {}, score: null, showScore: false },
    { loading: false, data: null, answers: {}, score: null, showScore: false },
  ]);

  // Collected session data for final submit
  const [roundSessions, setRoundSessions] = useState<RoundAnswerSet[]>([]);

  // Guard: prevent a round from being submitted more than once concurrently
  const roundInFlight = useRef(false);

  // Steps 4-5
  const [goals, setGoals] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState('');
  const [hours, setHours] = useState(10);
  const [style, setStyle] = useState('mixed');
  const [priorTools, setPriorTools] = useState<string[]>([]);

  useEffect(() => {
    if (!cohortSlug) return;
    api.learningPath.getCohort(cohortSlug)
      .then(c => setCohort(c))
      .catch(() => setError('Failed to load cohort. Please go back and try again.'))
      .finally(() => setLoadingCohort(false));
  }, [cohortSlug]);

  // ── Fetch a round from the API ────────────────────────────────────────────
  const fetchRound = useCallback(async (
    roundNum: 1 | 2 | 3,
    previousSessionId?: string,
    previousAnswers?: MCQAnswer[],
  ) => {
    console.log(`[FETCH] fetchRound(${roundNum}) called`);
    const idx = roundNum - 1;
    setRounds(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], loading: true };
      return next;
    });
    setError('');
    try {
      const res = await api.learningPath.generateAssessmentQuestions({
        cohort_slug: cohortSlug!,
        round: roundNum,
        known_topics: langs.filter(l => l !== 'None'),
        language_levels: langLevels,
        previous_session_id: previousSessionId,
        previous_answers: previousAnswers,
      });
      console.log(`[FETCH] Round ${roundNum} OK:`, res.round_title, `| ${res.questions.length} Qs`);
      setRounds(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], loading: false, data: res };
        return next;
      });
    } catch (e: any) {
      console.error(`[FETCH] Round ${roundNum} error:`, e);
      setError(e?.response?.data?.detail || `Failed to generate Round ${roundNum} questions.`);
      setRounds(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], loading: false };
        return next;
      });
    }
  }, [cohortSlug, langs, langLevels]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goTo = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const toggleArr = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  // ── After Step 0: fetch Round 1 ───────────────────────────────────────────
  const handleStep0Next = async () => {
    goTo(1);
    if (!rounds[0].data) {
      await fetchRound(1);
    }
  };

  // ── After Round N answered: record session, show score, fetch next round ──
  const handleRoundSubmit = async (roundNum: 1 | 2 | 3) => {
    if (roundInFlight.current) {
      console.log('[SUBMIT] blocked — already in flight');
      return;
    }
    roundInFlight.current = true;
    console.log(`[SUBMIT] Round ${roundNum} submit started`);

    const idx = roundNum - 1;

    // Read directly from current rounds state (not via setter)
    const roundData = rounds[idx].data;
    if (!roundData) {
      console.error(`[SUBMIT] Round ${roundNum} — no data, aborting`);
      roundInFlight.current = false;
      return;
    }

    const answers: MCQAnswer[] = (roundData.questions || []).map(q => ({
      question_id: q.id,
      selected_option: rounds[idx].answers[q.id] ?? 0,
    }));

    console.log(`[SUBMIT] Round ${roundNum} answers:`, answers);

    // Disable submit button immediately
    setRounds(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], loading: true };
      return next;
    });

    // Record session for final submit
    setRoundSessions(prev => [
      ...prev.filter(s => s.session_id !== roundData.session_id),
      { session_id: roundData.session_id, answers },
    ]);

    if (roundNum < 3) {
      const nextRound = (roundNum + 1) as 2 | 3;
      const nextIdx = nextRound - 1;

      const payload = {
        cohort_slug: cohortSlug!,
        round: nextRound,
        known_topics: langs.filter(l => l !== 'None'),
        language_levels: langLevels,
        previous_session_id: roundData.session_id,
        previous_answers: answers,
      };
      console.log(`[SUBMIT] Requesting Round ${nextRound} — payload:`, JSON.stringify(payload));
      try {
        const res = await api.learningPath.generateAssessmentQuestions(payload);
        console.log(`[SUBMIT] Round ${nextRound} received:`, res.round_title, `| ${res.questions.length} questions`);

        setRounds(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], loading: false, score: res.previous_round_score, showScore: true };
          next[nextIdx] = { ...next[nextIdx], loading: false, data: res };
          return next;
        });
      } catch (e: any) {
        console.error(`[SUBMIT] Round ${nextRound} failed:`, e);
        setError(e?.response?.data?.detail || `Failed to generate Round ${nextRound} questions.`);
        setRounds(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], loading: false };
          next[nextIdx] = { ...next[nextIdx], loading: false };
          return next;
        });
      }
    } else {
      // Round 3 done — go to Goals
      console.log('[SUBMIT] Round 3 complete, going to Goals');
      setRounds(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], loading: false, showScore: true, score: { correct: 0, total: answers.length, percentage: 0, weak_areas: [] } };
        return next;
      });
      goTo(4);
    }

    roundInFlight.current = false;
    console.log(`[SUBMIT] Round ${roundNum} submit complete`);
  };

  // ── Continue from score card to next round view ───────────────────────────
  const handleScoreContinue = (roundNum: 1 | 2 | 3) => {
    const idx = roundNum - 1;
    setRounds(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], showScore: false };
      return next;
    });
    goTo(roundNum + 1); // step index = roundNum (Round 2 is step 2)
  };

  // ── canNext per step ──────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) {
      if (!role || !education) return false;
      const activeLangs = langs.filter(l => l !== 'None');
      // If languages selected, require proficiency set for each
      if (activeLangs.length > 0 && activeLangs.some(l => !langLevels[l])) return false;
      return true;
    }
    if (step >= 1 && step <= 3) {
      const idx = step - 1;
      const rd = rounds[idx];
      if (!rd.data) return false;
      return (rd.data.questions || []).every(q => rd.answers[q.id] !== undefined);
    }
    if (step === 4) return goals.length > 0;
    return true;
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cohort || !cohortSlug) return;
    setSubmitting(true);
    setError('');
    try {
      await api.learningPath.submitAssessment({
        cohort_slug: cohortSlug,
        step1: {
          current_role: role,
          experience_years: expYears,
          education,
          programming_languages: langs.filter(l => l !== 'None'),
          language_levels: langLevels,
          project_types: projectTypes,
          project_description: projectDescription,
        },
        step2: { round_sessions: roundSessions },
        step3: { goals, focus_areas: focusAreas, custom_goal: customGoal },
        step4: { hours_per_week: hours, learning_style: style, prior_tools: priorTools },
      });
      navigate('/learning-path/result');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingCohort) return (
    <div className="assess-loading"><span className="lp-spinner" /><span>Loading assessment…</span></div>
  );
  if (!cohort) return <div className="assess-error">{error || 'Cohort not found.'}</div>;

  const currentRoundIdx = step >= 1 && step <= 3 ? step - 1 : -1;
  const currentRound = currentRoundIdx >= 0 ? rounds[currentRoundIdx] : null;

  return (
    <div className="assess-page">
      {/* ── Progress stepper ── */}
      <div className="assess-header">
        <div className="assess-cohort-badge">
          <span className="assess-cohort-icon">{cohort.icon}</span>
          <span className="assess-cohort-name">{cohort.name}</span>
        </div>
        <div className="assess-stepper">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className={`assess-step ${i < step ? 'assess-step--done' : i === step ? 'assess-step--active' : ''}`}>
                <div className="assess-step__dot">
                  {i < step ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="assess-step__label">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`assess-step__line ${i < step ? 'assess-step__line--done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="assess-body card">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit">

            {/* ── Step 0: About You ── */}
            {step === 0 && (
              <div className="assess-step-content">
                <h2 className="assess-step-title">Tell us about yourself</h2>
                <p className="assess-step-sub">The more detail you give, the better we can calibrate your assessment and learning path.</p>

                <div className="assess-section">
                  <div className="assess-section-title">Background</div>
                  <div className="assess-fields">
                    <div className="assess-field">
                      <label className="assess-label">Current Role</label>
                      <div className="assess-tag-grid">
                        {ROLE_OPTIONS.map(r => <Tag key={r} label={r} selected={role === r} onClick={() => setRole(r)} />)}
                      </div>
                    </div>
                    <div className="assess-field">
                      <label className="assess-label">Highest Education</label>
                      <div className="assess-tag-grid">
                        {EDUCATION_OPTIONS.map(e => <Tag key={e} label={e} selected={education === e} onClick={() => setEducation(e)} />)}
                      </div>
                    </div>
                    <div className="assess-field">
                      <label className="assess-label">Total Years of Programming Experience</label>
                      <div className="assess-slider-wrap">
                        <input type="range" min={0} max={20} value={expYears} onChange={e => setExpYears(+e.target.value)} className="assess-slider" />
                        <span className="assess-slider-val">{expYears === 20 ? '20+' : expYears} yr{expYears !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="assess-section">
                  <div className="assess-section-title">Technical Skills</div>
                  <div className="assess-fields">
                    <div className="assess-field">
                      <label className="assess-label">Languages & Technologies you know</label>
                      <p className="assess-field-hint">Round 1 questions will be drawn from these. Select all that apply.</p>
                      <div className="assess-tag-grid">
                        {LANG_OPTIONS.map(l => (
                          <Tag key={l} label={l} selected={langs.includes(l)}
                            onClick={() => {
                              const isOn = langs.includes(l);
                              setLangs(isOn ? langs.filter(x => x !== l) : [...langs, l]);
                              if (isOn) {
                                setLangLevels(prev => { const n = { ...prev }; delete n[l]; return n; });
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {langs.filter(l => l !== 'None').length > 0 && (
                      <div className="assess-field">
                        <label className="assess-label">Proficiency per Language</label>
                        <p className="assess-field-hint">This directly calibrates the difficulty of Round 1 questions for each language.</p>
                        <div className="assess-proficiency-list">
                          {langs.filter(l => l !== 'None').map(lang => (
                            <div key={lang} className="assess-proficiency-row">
                              <span className="assess-proficiency-lang">{lang}</span>
                              <div className="assess-proficiency-btns">
                                {PROFICIENCY_LEVELS.map(lvl => (
                                  <button
                                    key={lvl.value}
                                    type="button"
                                    title={lvl.desc}
                                    className={`assess-level-btn assess-level-btn--${lvl.value} ${langLevels[lang] === lvl.value ? 'assess-level-btn--on' : ''}`}
                                    onClick={() => setLangLevels(prev => ({ ...prev, [lang]: lvl.value }))}
                                  >
                                    {lvl.label}
                                  </button>
                                ))}
                              </div>
                              {langLevels[lang] && (
                                <span className="assess-level-desc">
                                  {PROFICIENCY_LEVELS.find(p => p.value === langLevels[lang])?.desc}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="assess-section">
                  <div className="assess-section-title">Project Experience</div>
                  <div className="assess-fields">
                    <div className="assess-field">
                      <label className="assess-label">What have you built? <span className="assess-optional">(select all that apply)</span></label>
                      <div className="assess-tag-grid">
                        {PROJECT_TYPES.map(p => <Tag key={p} label={p} selected={projectTypes.includes(p)} onClick={() => toggleArr(projectTypes, setProjectTypes, p)} />)}
                      </div>
                    </div>
                    <div className="assess-field">
                      <label className="assess-label">Describe your most significant project <span className="assess-optional">(optional but helps a lot)</span></label>
                      <textarea
                        className="assess-textarea"
                        placeholder="e.g. I built a REST API for a library management system using FastAPI and PostgreSQL. The main challenge was designing efficient database queries and handling concurrent requests. I deployed it on AWS EC2."
                        rows={4}
                        value={projectDescription}
                        onChange={e => setProjectDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Steps 1-3: Assessment Rounds ── */}
            {step >= 1 && step <= 3 && currentRound && (
              <div className="assess-step-content">
                {/* Loading state — shown both when fetching questions AND when submitting */}
                {currentRound.loading && (
                  <div className="assess-round-loading">
                    <span className="lp-spinner lp-spinner--lg" />
                    <p>
                      {currentRound.data
                        ? 'Scoring your answers and preparing the next round…'
                        : `Generating Round ${step} questions${step > 1 ? ' based on your previous answers' : ''}…`}
                    </p>
                    <p className="assess-round-loading-sub">Checking knowledge base for relevant content</p>
                  </div>
                )}

                {/* Score card between rounds */}
                {!currentRound.loading && currentRound.showScore && step < 3 && (
                  <RoundScoreCard
                    roundNum={step}
                    score={currentRound.score}
                    nextRoundTitle={`Round ${step + 1}`}
                    onContinue={() => handleScoreContinue(step as 1 | 2 | 3)}
                    loading={rounds[step].loading}
                  />
                )}

                {/* Questions */}
                {!currentRound.loading && !currentRound.showScore && currentRound.data && (
                  <>
                    <div className="assess-round-header">
                      <div className="assess-round-meta">
                        <span className="assess-round-badge">Round {step}</span>
                        <h2 className="assess-step-title">{currentRound.data.round_title}</h2>
                        <p className="assess-step-sub">{currentRound.data.round_description}</p>
                      </div>
                      <div className="assess-round-info">
                        {currentRound.data.focus_topics?.length > 0 && (
                          <div className="assess-focus-topics">
                            <span>Focus: </span>
                            {currentRound.data.focus_topics.map(t => <span key={t} className="assess-focus-chip">{t}</span>)}
                          </div>
                        )}
                        {currentRound.data.rag_used && (
                          <span className="assess-rag-badge" title="Questions generated from your cohort's knowledge base">
                            📚 Curriculum-grounded
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="assess-step-sub assess-honesty-note">
                      Answer honestly — there's no penalty for wrong answers. Your responses shape your personalised path.
                    </p>

                    <div className="assess-mcq-list">
                      {(currentRound.data.questions || []).map((q, i) => (
                        <MCQCard
                          key={q.id}
                          q={q}
                          idx={i}
                          selected={currentRound.answers[q.id]}
                          onSelect={v => setRounds(prev => {
                            const next = [...prev];
                            next[step - 1] = { ...next[step - 1], answers: { ...next[step - 1].answers, [q.id]: v } };
                            return next;
                          })}
                        />
                      ))}
                    </div>
                  </>
                )}

                {error && <div className="assess-error-msg">{error}</div>}
              </div>
            )}

            {/* ── Step 4: Goals ── */}
            {step === 4 && (
              <div className="assess-step-content">
                <h2 className="assess-step-title">What are your goals?</h2>
                <p className="assess-step-sub">Select all that apply — your path will be optimised toward them.</p>
                <div className="assess-fields">
                  <div className="assess-field">
                    <label className="assess-label">Primary Goals</label>
                    <div className="assess-tag-grid">
                      {(cohort.goal_options || []).map(g => <Tag key={g} label={g} selected={goals.includes(g)} onClick={() => toggleArr(goals, setGoals, g)} />)}
                    </div>
                  </div>
                  <div className="assess-field">
                    <label className="assess-label">Focus Areas <span className="assess-optional">(optional)</span></label>
                    <div className="assess-tag-grid">
                      {(cohort.focus_area_options || []).map(f => <Tag key={f} label={f} selected={focusAreas.includes(f)} onClick={() => toggleArr(focusAreas, setFocusAreas, f)} />)}
                    </div>
                  </div>
                  <div className="assess-field">
                    <label className="assess-label">Anything specific you want to achieve? <span className="assess-optional">(optional)</span></label>
                    <textarea className="assess-textarea" placeholder="e.g. I want to build a full-stack e-commerce app and get placed at a product company." rows={3} value={customGoal} onChange={e => setCustomGoal(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Schedule ── */}
            {step === 5 && (
              <div className="assess-step-content">
                <h2 className="assess-step-title">Schedule & Learning Style</h2>
                <p className="assess-step-sub">Your available time affects how we pace the curriculum for you.</p>
                <div className="assess-fields">
                  <div className="assess-field">
                    <label className="assess-label">Hours available per week</label>
                    <div className="assess-slider-wrap">
                      <input type="range" min={2} max={60} step={2} value={hours} onChange={e => setHours(+e.target.value)} className="assess-slider" />
                      <span className="assess-slider-val">{hours} hrs/week</span>
                    </div>
                    <div className="assess-slider-ticks"><span>2 hrs</span><span>15 hrs</span><span>30 hrs</span><span>60 hrs</span></div>
                  </div>
                  <div className="assess-field">
                    <label className="assess-label">Preferred Learning Style</label>
                    <div className="assess-style-grid">
                      {STYLE_OPTIONS.map(s => (
                        <button key={s.value} type="button" className={`assess-style-card ${style === s.value ? 'assess-style-card--on' : ''}`} onClick={() => setStyle(s.value)}>
                          <span className="assess-style-card__label">{s.label}</span>
                          <span className="assess-style-card__sub">{s.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="assess-field">
                    <label className="assess-label">Tools you've already used <span className="assess-optional">(select all that apply)</span></label>
                    <div className="assess-tag-grid">
                      {TOOL_OPTIONS.map(t => <Tag key={t} label={t} selected={priorTools.includes(t)} onClick={() => toggleArr(priorTools, setPriorTools, t)} />)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 6: Generate ── */}
            {step === 6 && (
              <div className="assess-step-content assess-step-content--center">
                <div className="assess-generate-icon">🚀</div>
                <h2 className="assess-step-title">Ready to generate your path!</h2>
                <p className="assess-step-sub">
                  We'll analyse your 3-round assessment and build a fully personalised {cohort.name} roadmap.
                </p>
                <div className="assess-summary">
                  <div className="assess-summary-row"><span>Cohort</span><strong>{cohort.name}</strong></div>
                  <div className="assess-summary-row"><span>Role</span><strong>{role}</strong></div>
                  <div className="assess-summary-row"><span>Experience</span><strong>{expYears} yr{expYears !== 1 ? 's' : ''}</strong></div>
                  <div className="assess-summary-row"><span>Rounds completed</span><strong>{roundSessions.length} / 3</strong></div>
                  <div className="assess-summary-row"><span>Goals</span><strong>{goals.join(', ') || '—'}</strong></div>
                  <div className="assess-summary-row"><span>Time available</span><strong>{hours} hrs/week</strong></div>
                  <div className="assess-summary-row"><span>Learning style</span><strong style={{ textTransform: 'capitalize' }}>{style}</strong></div>
                </div>
                {error && <div className="assess-error-msg">{error}</div>}
                <button className="assess-generate-btn" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><span className="lp-spinner" /> Generating your path…</> : '✨  Generate My Learning Path'}
                </button>
                <p className="assess-generate-note">This may take 15–30 seconds. The AI will build your personalised roadmap.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <div className="assess-nav">
        <button
          className="assess-nav-btn assess-nav-btn--back"
          onClick={() => step === 0 ? navigate('/learning-path') : goTo(step - 1)}
          disabled={submitting || (currentRound?.loading ?? false)}
        >
          ← {step === 0 ? 'Back to Cohorts' : 'Previous'}
        </button>
        <span className="assess-nav-progress">{step + 1} / {TOTAL_STEPS}</span>

        {/* Step 0 → Round 1 */}
        {step === 0 && (
          <button
            className="assess-nav-btn assess-nav-btn--next"
            onClick={handleStep0Next}
            disabled={!canNext()}
          >
            Start Assessment →
          </button>
        )}

        {/* Round steps: show Submit Round button when questions loaded & answered */}
        {step >= 1 && step <= 3 && currentRound && !currentRound.loading && !currentRound.showScore && currentRound.data && (
          <button
            className="assess-nav-btn assess-nav-btn--next"
            onClick={() => handleRoundSubmit(step as 1 | 2 | 3)}
            disabled={!canNext() || submitting || currentRound.loading}
          >
            {step < 3 ? 'Submit Round →' : 'Finish Assessment →'}
          </button>
        )}

        {/* Round score → next round */}
        {step >= 1 && step <= 2 && currentRound?.showScore && (
          <button
            className="assess-nav-btn assess-nav-btn--next"
            onClick={() => handleScoreContinue(step as 1 | 2)}
            disabled={rounds[step]?.loading}
          >
            {rounds[step]?.loading
              ? <><span className="lp-spinner" /> Loading…</>
              : `Continue to Round ${step + 1} →`}
          </button>
        )}

        {/* Goals / Schedule / Generate */}
        {step >= 4 && step < TOTAL_STEPS - 1 && (
          <button
            className="assess-nav-btn assess-nav-btn--next"
            onClick={() => goTo(step + 1)}
            disabled={!canNext()}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

export default AssessmentPage;
