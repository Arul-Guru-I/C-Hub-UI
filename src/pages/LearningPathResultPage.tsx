import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type { LearningPath, LPPhaseOut, LPTopic } from '../services/api';
import { TargetIcon, ClockIcon2, LayersIcon, BookOpenIcon, ZapIcon, MapIcon } from '../components/ui/Icons';
import './LearningPathResultPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SKILL_META = {
  beginner:     { label: 'Beginner',     color: '#22d3a0', bg: 'rgba(34,211,160,0.1)',  border: 'rgba(34,211,160,0.25)' },
  intermediate: { label: 'Intermediate', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' },
  advanced:     { label: 'Advanced',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)' },
};

const STATUS_META = {
  learn:  { label: 'Learn',  color: 'var(--color-primary)',  bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.25)' },
  review: { label: 'Review', color: 'var(--color-warning)',  bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)' },
  skip:   { label: 'Skip',   color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)', border: 'var(--color-border)' },
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'var(--color-danger)', medium: 'var(--color-warning)', low: 'var(--color-text-muted)',
};

function totalHours(path: LearningPath) {
  return path.phases.reduce((s, ph) =>
    s + ph.topics.reduce((t, tp) => t + (tp.estimated_hours || 0), 0), 0);
}

function learnCount(path: LearningPath) {
  return path.phases.reduce((s, ph) =>
    s + ph.topics.filter(t => t.status === 'learn').length, 0);
}

// ── TopicRow ──────────────────────────────────────────────────────────────────
const TopicRow: React.FC<{ topic: LPTopic; isLast: boolean }> = ({ topic, isLast }) => {
  const [open, setOpen] = useState(false);
  const sm = STATUS_META[topic.status] || STATUS_META.learn;

  return (
    <div className={`lpr-topic ${isLast ? 'lpr-topic--last' : ''} ${topic.status === 'skip' ? 'lpr-topic--skip' : ''}`}>
      <div className="lpr-topic__row" onClick={() => topic.status !== 'skip' && setOpen(v => !v)}>
        {/* Timeline dot */}
        <div className="lpr-topic__dot-wrap">
          <div className="lpr-topic__dot" style={{ background: sm.color }} />
          {!isLast && <div className="lpr-topic__line" />}
        </div>

        <div className="lpr-topic__main">
          <div className="lpr-topic__header">
            <span className="lpr-topic__name" style={{ opacity: topic.status === 'skip' ? 0.45 : 1 }}>
              {topic.name}
            </span>
            <div className="lpr-topic__badges">
              {topic.estimated_hours > 0 && topic.status !== 'skip' && (
                <span className="lpr-topic__hours">{topic.estimated_hours}h</span>
              )}
              <span className="lpr-topic__status" style={{ color: sm.color, background: sm.bg, borderColor: sm.border }}>
                {sm.label}
              </span>
              {topic.priority !== 'low' && topic.status !== 'skip' && (
                <span className="lpr-topic__priority-dot" style={{ background: PRIORITY_DOT[topic.priority] }} title={`${topic.priority} priority`} />
              )}
              {topic.status !== 'skip' && (
                <span className="lpr-topic__chevron" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
              )}
            </div>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                className="lpr-topic__detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.18 } }}
              >
                {topic.description && <p className="lpr-topic__desc">{topic.description}</p>}
                {topic.why && (
                  <p className="lpr-topic__why">
                    <span className="lpr-topic__why-label">Why:</span> {topic.why}
                  </p>
                )}
                {topic.resources?.length > 0 && (
                  <ul className="lpr-topic__resources">
                    {topic.resources.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ── PhaseCard ─────────────────────────────────────────────────────────────────
const PhaseCard: React.FC<{ phase: LPPhaseOut; idx: number; total: number }> = ({ phase, idx, total }) => {
  const [open, setOpen] = useState(idx === 0);
  const learnTopics = phase.topics.filter(t => t.status === 'learn').length;
  const phaseHours = phase.topics.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const progress = Math.round((learnTopics / Math.max(phase.topics.length, 1)) * 100);

  return (
    <motion.div
      className="lpr-phase"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
    >
      {/* Phase connector line */}
      {idx < total - 1 && <div className="lpr-phase__connector" />}

      <div className="lpr-phase__card card">
        {/* Header */}
        <div className="lpr-phase__header" onClick={() => setOpen(v => !v)}>
          <div className="lpr-phase__num">
            <span>Phase {phase.order}</span>
          </div>
          <div className="lpr-phase__info">
            <h3 className="lpr-phase__name">{phase.name}</h3>
            {phase.focus && <p className="lpr-phase__focus">{phase.focus}</p>}
          </div>
          <div className="lpr-phase__meta">
            <span className="lpr-phase__meta-item">
              <ClockIcon2 size={12} /> {phase.duration_weeks}w
            </span>
            <span className="lpr-phase__meta-item">
              <BookOpenIcon size={12} /> {phaseHours}h
            </span>
            <span className="lpr-phase__meta-item">
              <LayersIcon size={12} /> {learnTopics}/{phase.topics.length}
            </span>
            <span className={`lpr-phase__chevron ${open ? 'lpr-phase__chevron--open' : ''}`}>›</span>
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="lpr-phase__progress-bar">
          <div className="lpr-phase__progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Topics */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="lpr-phase__topics"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            >
              {phase.topics.map((t, i) => (
                <TopicRow key={t.name} topic={t} isLast={i === phase.topics.length - 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const LearningPathResultPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.learningPath.getMyProfile()
      .then(r => setProfile(r.profile))
      .finally(() => setLoading(false));
  }, []);

  const handleReset = async () => {
    if (!profile?.cohort_slug) return;
    if (!confirm('Reset your learning path for this cohort? You can retake the assessment.')) return;
    setResetting(true);
    await api.learningPath.resetProfile(profile.cohort_slug);
    navigate('/learning-path');
  };

  if (loading) return (
    <div className="lpr-loading"><span className="lp-spinner" /><span>Loading your path…</span></div>
  );

  if (!profile) return (
    <div className="lpr-empty">
      <MapIcon size={36} color="var(--color-text-muted)" />
      <p>You haven't generated a learning path yet.</p>
      <button className="lpr-start-btn" onClick={() => navigate('/learning-path')}>Choose a Cohort</button>
    </div>
  );

  const path: LearningPath = profile.learning_path;
  const skillMeta = SKILL_META[path.skill_level as keyof typeof SKILL_META] || SKILL_META.beginner;
  const hours = totalHours(path);
  const topics = learnCount(path);

  return (
    <div className="lpr-page">
      {/* ── Header ── */}
      <div className="lpr-header">
        <div className="lpr-header__left">
          <h1 className="lpr-title">Your Learning Path</h1>
          <p className="lpr-cohort-name">{profile.cohort_slug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
        </div>
        <div className="lpr-header__right">
          <span className="lpr-skill-badge" style={{ color: skillMeta.color, background: skillMeta.bg, borderColor: skillMeta.border }}>
            {skillMeta.label}
          </span>
          <button className="lpr-reset-btn" onClick={handleReset} disabled={resetting}>
            {resetting ? '…' : 'Retake Assessment'}
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="lpr-stats">
        {[
          { icon: <ClockIcon2 size={16} color="var(--color-primary)" />, val: `${path.total_weeks} weeks`, label: 'Duration' },
          { icon: <BookOpenIcon size={16} color="var(--color-gold)" />, val: `~${hours} hours`, label: 'Total Study Time' },
          { icon: <LayersIcon size={16} color="var(--color-purple)" />, val: `${path.phases.length} phases`, label: 'Phases' },
          { icon: <TargetIcon size={16} color="var(--color-success)" />, val: `${topics} topics`, label: 'To Learn' },
        ].map(s => (
          <div key={s.label} className="lpr-stat-card card">
            {s.icon}
            <span className="lpr-stat-val">{s.val}</span>
            <span className="lpr-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Notes ── */}
      {path.personalized_notes && (
        <div className="lpr-notes card">
          <div className="lpr-notes__head"><ZapIcon size={15} color="var(--color-gold)" /> Personalised Advice</div>
          <p className="lpr-notes__text">{path.personalized_notes}</p>
        </div>
      )}

      {/* ── Weekly schedule ── */}
      {path.weekly_schedule && (
        <div className="lpr-schedule card">
          <div className="lpr-schedule__head"><ClockIcon2 size={14} color="var(--color-primary)" /> Suggested Weekly Schedule</div>
          <p className="lpr-schedule__text">{path.weekly_schedule}</p>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="lpr-legend">
        {Object.entries(STATUS_META).map(([k, v]) => (
          <span key={k} className="lpr-legend-item">
            <span className="lpr-legend-dot" style={{ background: v.color }} />
            {v.label}
          </span>
        ))}
        <span className="lpr-legend-item"><span className="lpr-legend-dot" style={{ background: 'var(--color-danger)' }} />High priority</span>
      </div>

      {/* ── Phase cards ── */}
      <div className="lpr-phases">
        {path.phases.map((ph, i) => (
          <PhaseCard key={ph.name} phase={ph} idx={i} total={path.phases.length} />
        ))}
      </div>

      {/* ── Milestones ── */}
      {path.key_milestones?.length > 0 && (
        <div className="lpr-milestones card">
          <div className="lpr-milestones__head"><TargetIcon size={15} color="var(--color-success)" /> Key Milestones</div>
          <ol className="lpr-milestones__list">
            {path.key_milestones.map((m, i) => <li key={i}>{m}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
};

export default LearningPathResultPage;
