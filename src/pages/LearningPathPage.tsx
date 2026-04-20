import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { LPCohort } from '../services/api';
import { GraduationIcon, MapIcon, ArrowUpIcon, ZapIcon } from '../components/ui/Icons';
import './LearningPathPage.css';

const COHORT_META: Record<string, { badge: string; color: string }> = {
  'java-fsd':        { badge: 'Full Stack',      color: '#f89820' },
  'python-fsd':      { badge: 'Full Stack',      color: '#3776ab' },
  'data-engineering':{ badge: 'Data & ML',       color: '#00d4aa' },
  'cloud-devops':    { badge: 'Infrastructure',  color: '#8b5cf6' },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] } }),
};

const LearningPathPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<LPCohort[]>([]);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.learningPath.listCohorts(),
      api.learningPath.getMyProfile(),
    ])
      .then(([cohortsRes, profileRes]) => {
        setCohorts(cohortsRes.cohorts);
        setExistingProfile(profileRes.profile);
      })
      .catch(() => setError('Failed to load cohorts.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (slug: string) => {
    navigate(`/learning-path/assess/${slug}`);
  };

  const handleViewPath = () => {
    navigate('/learning-path/result');
  };

  const isTrainer = user?.role === 'trainer';

  if (loading) return (
    <div className="lp-loading">
      <span className="lp-spinner" />
      <span>Loading cohorts…</span>
    </div>
  );

  return (
    <div className="lp-page">
      {/* ── Hero ── */}
      <div className="lp-hero">
        <div className="lp-hero__icon"><GraduationIcon size={28} color="var(--color-primary)" /></div>
        <div>
          <h1 className="lp-hero__title">Personalised Learning Path</h1>
          <p className="lp-hero__sub">
            Select your cohort, complete a quick skill assessment, and get a tailored
            end-to-end roadmap built specifically for you.
          </p>
        </div>
        {isTrainer && (
          <button className="lp-trainer-btn" onClick={() => navigate('/learning-path/trainer')}>
            <ZapIcon size={14} /> Trainer Portal
          </button>
        )}
      </div>

      {/* ── Existing path banner ── */}
      {existingProfile && (
        <motion.div className="lp-existing-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="lp-existing-banner__left">
            <MapIcon size={18} color="var(--color-gold)" />
            <div>
              <p className="lp-existing-banner__title">You have an active learning path</p>
              <p className="lp-existing-banner__sub">
                {existingProfile.cohort_slug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} ·{' '}
                <span style={{ textTransform: 'capitalize' }}>{existingProfile.skill_level}</span>
              </p>
            </div>
          </div>
          <button className="lp-view-path-btn" onClick={handleViewPath}>
            <ArrowUpIcon size={13} style={{ transform: 'rotate(90deg)' }} /> View My Path
          </button>
        </motion.div>
      )}

      {error && <div className="lp-error">{error}</div>}

      {/* ── Cohort cards ── */}
      <div className="lp-section-label">Choose Your Cohort</div>
      <div className="lp-cohort-grid">
        {cohorts.map((c, i) => {
          const meta = COHORT_META[c.slug] || { badge: 'Cohort', color: 'var(--color-primary)' };
          return (
            <motion.div
              key={c.slug}
              className="lp-cohort-card"
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => handleSelect(c.slug)}
            >
              {/* Gradient bar */}
              <div className="lp-cohort-card__bar" style={{ background: c.gradient }} />

              <div className="lp-cohort-card__body">
                {/* Header */}
                <div className="lp-cohort-card__header">
                  <span className="lp-cohort-card__icon">{c.icon}</span>
                  <span className="lp-cohort-card__badge" style={{ color: meta.color, borderColor: meta.color + '40', background: meta.color + '14' }}>
                    {meta.badge}
                  </span>
                </div>

                <h3 className="lp-cohort-card__name">{c.name}</h3>
                <p className="lp-cohort-card__desc">{c.description}</p>

                {/* Tech stack pills */}
                <div className="lp-cohort-card__stack">
                  {c.tech_stack.slice(0, 5).map(t => (
                    <span key={t} className="lp-stack-pill">{t}</span>
                  ))}
                  {c.tech_stack.length > 5 && (
                    <span className="lp-stack-pill lp-stack-pill--more">+{c.tech_stack.length - 5}</span>
                  )}
                </div>

                {/* Footer */}
                <div className="lp-cohort-card__footer">
                  <span className="lp-cohort-card__duration">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {c.duration_weeks} weeks
                  </span>
                  <span className="lp-cohort-card__cta">
                    Start Assessment →
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LearningPathPage;
