import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { StudentOverview, CohortOverview } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { TrendUpIcon, UsersIcon, TaskIcon, ForumIcon, AttendanceIcon } from '../components/ui/Icons';
import './CohortsPage.css';

const CohortsPage: React.FC = () => {
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer';

  const [cohorts, setCohorts] = useState<{ slug: string, name: string, student_count: number, average_score: number }[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<CohortOverview | null>(null);
  const [students, setStudents] = useState<StudentOverview[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isTrainer) {
      api.cohorts.listCohorts()
        .then(data => {
            setCohorts(data);
            if (data.length > 0) setSelectedSlug(data[0].slug);
        })
        .catch(err => setError(err.response?.data?.detail || 'Failed to load cohorts'))
        .finally(() => setLoading(false));
    } else {
        setLoading(false);
    }
  }, [isTrainer]);

  useEffect(() => {
    if (selectedSlug) {
      setLoadingDetails(true);
      Promise.all([
        api.cohorts.getOverview(selectedSlug),
        api.cohorts.getStudents(selectedSlug)
      ]).then(([ov, st]) => {
        setOverview(ov);
        setStudents(st);
      }).catch(err => console.error("Failed to load details", err))
        .finally(() => setLoadingDetails(false));
    }
  }, [selectedSlug]);

  if (!isTrainer) {
    return <div className="page-content"><p>Access Denied. You must be a trainer to view this page.</p></div>;
  }

  return (
    <div className="page-content cohorts-page">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1>Cohorts Analytics</h1>
        <p>Monitor cohort progress, attendance, and forum engagement.</p>
      </div>

      {error ? (
        <div className="card" style={{ padding: '24px', color: 'var(--color-danger)' }}>{error}</div>
      ) : loading ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-sec)' }}>Loading...</div>
      ) : (
        <div className="cohorts-layout">
          {/* Sidebar list of cohorts */}
          <div className="cohorts-sidebar card" style={{ padding: '16px', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text-sec)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Cohorts</h3>
            {cohorts.map(c => (
              <button 
                key={c.slug} 
                className={`btn ${selectedSlug === c.slug ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'space-between', padding: '12px' }}
                onClick={() => setSelectedSlug(c.slug)}
              >
                <span>{c.name || c.slug}</span>
                <span className="badge" style={{ background: selectedSlug === c.slug ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-2)', color: 'inherit' }}>{c.student_count}</span>
              </button>
            ))}
            {cohorts.length === 0 && <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No cohorts found.</p>}
          </div>

          {/* Details Panel */}
          <div className="cohorts-main">
            {loadingDetails ? (
               <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-sec)' }}>Loading details...</div>
            ) : overview && students ? (
              <div className="anim-fade-up">
                
                {/* Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div className="card stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <UsersIcon size={24} color="var(--color-primary)" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview.total_students}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sec)' }}>Students</span>
                  </div>
                  <div className="card stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <TrendUpIcon size={24} color="var(--color-success)" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview.average_score.toFixed(1)}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sec)' }}>Avg Score</span>
                  </div>
                  <div className="card stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <AttendanceIcon size={24} color="var(--color-warning)" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview.total_attendances}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sec)' }}>Check-ins</span>
                  </div>
                  <div className="card stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <ForumIcon size={24} color="var(--color-info)" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview.total_forum_posts}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sec)' }}>Forum Posts</span>
                  </div>
                </div>

                {/* Students Table */}
                <div className="card">
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                    Students
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text-sec)' }}>
                        <th style={{ padding: '12px 20px' }}>Name</th>
                        <th style={{ padding: '12px 20px' }}>Email</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Latest Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.user_id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 500 }}>{s.name}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--color-text-sec)', fontSize: '0.9rem' }}>{s.email}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                            <span className="badge badge-success">{s.latest_score !== null && s.latest_score !== undefined ? s.latest_score : 'N/A'}</span>
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students in this cohort yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default CohortsPage;
