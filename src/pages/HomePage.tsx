import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { PerformanceLog } from '../services/api';
import { CheckIcon, TestIcon, PlusIcon, TrendUpIcon, TrendDownIcon } from '../components/ui/Icons';
import './HomePage.css';

const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: string | number; change?: number; color: string;
}> = ({ icon, label, value, change, color }) => (
  <div className="stat-card card card-gradient anim-fade-up">
    <div className="stat-card__header">
      <span className="stat-card__icon" style={{ color }}>{icon}</span>
      {change !== undefined && (
        <span className={`stat-card__change ${change >= 0 ? 'up' : 'down'}`}>
          {change >= 0 ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />} {Math.abs(change)}%
        </span>
      )}
    </div>
    <div className="stat-card__value">{value}</div>
    <div className="stat-card__label">{label}</div>
    <div className="stat-card__bar">
       <div className="stat-card__bar-fill" style={{ width: `${Math.min(Number(value) || 0, 100)}%`, background: color }} />
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPerf = async () => {
      if (!user) return;
      try {
        const idToUse = user._id || user.email; // Fallbacks
        const data = await api.performance.getPerformance(idToUse);
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch performance logs", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerf();
  }, [user]);

  const avgScore = logs.length > 0 
    ? Math.round(logs.reduce((acc, log) => acc + log.score, 0) / logs.length) 
    : 0;

  const totalReviews = logs.length;

  return (
    <div className="page-content home-page">
      {/* Welcome Banner */}
      <div className="home-banner card card-gradient anim-slide-in">
        <div className="home-banner__text">
          <h2 className="home-banner__title">Welcome back, {user?.name || 'Developer'}!</h2>
          <p className="home-banner__sub">Here's your code performance dashboard.</p>
        </div>
        <div className="home-banner__actions">
          <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/forum'}>
            <PlusIcon size={14} /> Join Discussion
          </button>
        </div>
      </div>

      <div className="grid-4 home-stats">
        <StatCard icon={<CheckIcon size={20} />} label="Total Reviews" value={totalReviews} color="var(--color-info)" />
        <StatCard icon={<TestIcon size={20} />} label="Average Score" value={avgScore} color="var(--color-primary)" />
      </div>

      <div className="home-lower">
        <div className="card home-activity anim-fade-up anim-delay-1" style={{ width: '100%' }}>
          <div className="section-header">
            <h3 className="section-title">Recent Performance Logs</h3>
          </div>
          {isLoading ? (
            <div style={{ padding: '20px', color: 'var(--color-text-sec)', textAlign: 'center' }}>Loading performance data...</div>
          ) : (
            <ul className="activity-list">
              {logs.length === 0 && <li style={{ padding: '20px', color: 'var(--color-text-sec)' }}>No performance logs recorded yet.</li>}
              {logs.map((log, i) => (
                <li key={log._id || i} className="activity-item" style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="activity-item__text" style={{ fontWeight: 600 }}>
                    PR #{log.pr_number} scored {log.score}/100
                  </span>
                  <span className="activity-item__time">
                    {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
