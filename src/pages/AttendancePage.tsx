import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type {
  AttendanceSession,
  AttendanceSessionDetail,
  CreateSessionResponse,
  MyAttendanceRecord,
  MyQRResponse,
} from '../services/api';
import { CalendarIcon, ClockIcon, UserIcon, QrIcon, PlusIcon, XIcon, CheckIcon } from '../components/ui/Icons';

const formatDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

// ─── Shared: Tab bar ─────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '10px 16px', fontSize: '0.875rem',
          fontWeight: active === t.id ? 600 : 400,
          color: active === t.id ? 'var(--color-secondary)' : 'var(--color-text-sec)',
          borderBottom: active === t.id ? '2px solid var(--color-secondary)' : '2px solid transparent',
          transition: 'color var(--transition-fast)',
        }}
      >
        {t.label}
      </button>
    ))}
  </div>
);

// ─── Shared: QR Modal ─────────────────────────────────────────────────────────

interface QRModalProps {
  title: string;
  qrBase64: string;
  checkInUrl: string;
  onClose: () => void;
}

const QRModal: React.FC<QRModalProps> = ({ title, qrBase64, checkInUrl, onClose }) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    onClick={onClose}
  >
    <div className="card" style={{ padding: '32px', maxWidth: '380px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          <XIcon size={16} />
        </button>
      </div>
      <img src={qrBase64} alt="QR Code" style={{ width: '100%', borderRadius: 'var(--radius-md)', background: '#fff', padding: '8px' }} />
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '12px', wordBreak: 'break-all' }}>{checkInUrl}</p>
    </div>
  </div>
);

// ─── Trainer: Create Session Form ─────────────────────────────────────────────

interface CreateSessionFormProps {
  onCreated: (result: CreateSessionResponse) => void;
  onCancel: () => void;
  cohorts: string[];
}

const CreateSessionForm: React.FC<CreateSessionFormProps> = ({ onCreated, onCancel, cohorts }) => {
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiresMinutes, setExpiresMinutes] = useState(30);
  const [cohort, setCohort] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) { setError('Subject is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await api.attendance.createSession({ 
        subject: subject.trim(), 
        ...(date ? { date } : {}), 
        expires_minutes: expiresMinutes,
        cohort: cohort || null
      });
      onCreated(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card anim-fade-up" style={{ marginBottom: '24px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>New Attendance Session</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          <XIcon size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-sec)', marginBottom: '6px' }}>Subject *</label>
          <input
            type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Python Basics — Week 3"
            style={{ width: '100%', padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-pri)', fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-sec)', marginBottom: '6px' }}>Target Cohort (Optional)</label>
          <select
            value={cohort} onChange={e => setCohort(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-pri)', fontSize: '0.875rem' }}
          >
            <option value="">Global (All Cohorts)</option>
            {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-sec)', marginBottom: '6px' }}>Date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-pri)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-sec)', marginBottom: '6px' }}>Expires (minutes)</label>
            <input
              type="number" value={expiresMinutes} min={5} max={480} onChange={e => setExpiresMinutes(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-pri)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Session'}</button>
        </div>
      </form>
    </div>
  );
};

// ─── Trainer: Session Detail Panel ────────────────────────────────────────────

interface SessionDetailProps {
  sessionId: string;
  onClose: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({ sessionId, onClose }) => {
  const [detail, setDetail] = useState<AttendanceSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myQR, setMyQR] = useState<MyQRResponse | null>(null);
  const [myQRLoading, setMyQRLoading] = useState(false);

  useEffect(() => {
    api.attendance.getSession(sessionId)
      .then(setDetail)
      .catch(err => setError(err.response?.data?.detail || 'Failed to load session.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleGetMyQR = async () => {
    setMyQRLoading(true);
    try { setMyQR(await api.attendance.getMyQR(sessionId)); }
    catch (err: any) { alert(err.response?.data?.detail || 'Failed to get QR code.'); }
    finally { setMyQRLoading(false); }
  };

  if (loading) return <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading session…</div>;
  if (error)   return <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>;
  if (!detail) return null;

  const expired = isExpired(detail.expires_at);

  return (
    <div className="card anim-fade-up" style={{ padding: '24px' }}>
      {myQR && <QRModal title="Your Personal Check-in QR" qrBase64={myQR.qr_code_base64} checkInUrl={myQR.check_in_url} onClose={() => setMyQR(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 600 }}>{detail.subject}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <CalendarIcon size={12} /> {formatDate(detail.date)} · Created by {detail.created_by_name}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <XIcon size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`badge badge--${detail.active && !expired ? 'success' : 'danger'}`}>
          {detail.active && !expired ? 'Active' : 'Inactive'}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <ClockIcon size={12} /> Expires {formatDateTime(detail.expires_at)}
        </span>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          onClick={handleGetMyQR} disabled={myQRLoading}
        >
          <QrIcon size={13} /> {myQRLoading ? 'Generating…' : 'Get My QR'}
        </button>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Attendees ({detail.total_count})</div>
      {detail.attendees.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No check-ins yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {detail.attendees.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{a.user_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <ClockIcon size={11} /> {formatDateTime(a.checked_in_at)}
                </div>
              </div>
              <CheckIcon size={14} color="var(--color-success)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Trainer: Sessions Tab ────────────────────────────────────────────────────

const TrainerSessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSessionQR, setNewSessionQR] = useState<CreateSessionResponse | null>(null);
  const [filterCohort, setFilterCohort] = useState('all');
  const [cohorts, setCohorts] = useState<string[]>([]);

  useEffect(() => {
    api.users.getAvailableCohorts().then(setCohorts).catch(console.error);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try { setSessions(await api.attendance.listSessions(0, 50, filterCohort === 'all' ? undefined : filterCohort)); }
    catch (err: any) { setError(err.response?.data?.detail || 'Failed to load sessions.'); }
    finally { setLoading(false); }
  }, [filterCohort]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreated = (result: CreateSessionResponse) => {
    setShowForm(false);
    setNewSessionQR(result);
    loadSessions();
  };

  if (loading) return <p style={{ color: 'var(--color-text-muted)', padding: '24px 0' }}>Loading sessions…</p>;
  if (error)   return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  return (
    <div>
      {newSessionQR && (
        <QRModal
          title={`Session QR — ${newSessionQR.session.subject}`}
          qrBase64={newSessionQR.qr_code_base64}
          checkInUrl={newSessionQR.check_in_url}
          onClose={() => setNewSessionQR(null)}
        />
      )}

      {showForm ? (
        <CreateSessionForm onCreated={handleCreated} onCancel={() => setShowForm(false)} cohorts={cohorts} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-sec)' }}>Cohort:</span>
            <select
              value={filterCohort} onChange={e => setFilterCohort(e.target.value)}
              className="form-input"
              style={{ background: 'var(--color-surface-2)', padding: '6px 12px', border: '1px solid var(--color-border)' }}
            >
              <option value="all">All sessions</option>
              {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => { setSelectedId(null); setShowForm(true); }}>
            <PlusIcon size={14} /> New Session
          </button>
        </div>
      )}

      {selectedId && !showForm && (
        <div style={{ marginBottom: '20px' }}>
          <SessionDetail sessionId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>No sessions yet. Create one above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map(s => {
            const expired = isExpired(s.expires_at);
            const isSelected = selectedId === s.id;
            return (
              <div
                key={s.id} className="card"
                style={{ padding: '16px 20px', cursor: 'pointer', border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent', transition: 'border var(--transition-fast)' }}
                onClick={() => setSelectedId(isSelected ? null : s.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>{s.subject}</span>
                  <span className={`badge badge--${s.active && !expired ? 'success' : 'muted'}`} style={{ fontSize: '0.7rem' }}>
                    {s.active && !expired ? 'Active' : 'Ended'}
                  </span>
                  {s.cohort && <span className="badge badge--info" style={{ fontSize: '0.7rem' }}>{s.cohort}</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span><CalendarIcon size={11} /> {formatDate(s.date)}</span>
                  <span><ClockIcon size={11} /> Expires {formatDateTime(s.expires_at)}</span>
                  <span><UserIcon size={11} /> {s.created_by_name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Student: Session QR Card ─────────────────────────────────────────────────
// Fetches the personal QR for one session and displays it inline.

interface StudentSessionCardProps {
  session: AttendanceSession;
}

const StudentSessionCard: React.FC<StudentSessionCardProps> = ({ session }) => {
  const [qr, setQr] = useState<MyQRResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.attendance.getMyQR(session.id)
      .then(setQr)
      .catch(err => setError(err.response?.data?.detail || 'Could not load QR.'))
      .finally(() => setLoading(false));
  }, [session.id]);

  const expired = isExpired(session.expires_at);
  const active = session.active && !expired;

  return (
    <div className="card" style={{ padding: '20px', opacity: active ? 1 : 0.6 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{session.subject}</span>
            <span className={`badge badge--${active ? 'success' : 'muted'}`} style={{ fontSize: '0.7rem' }}>
              {active ? 'Active' : 'Ended'}
            </span>
            {session.cohort && <span className="badge badge--info" style={{ fontSize: '0.7rem' }}>{session.cohort}</span>}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span><CalendarIcon size={11} /> {formatDate(session.date)}</span>
            <span><ClockIcon size={11} /> Expires {formatDateTime(session.expires_at)}</span>
            <span><UserIcon size={11} /> {session.created_by_name}</span>
          </div>
        </div>
      </div>

      {/* QR area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {loading && (
          <div style={{ width: '100%', maxWidth: 200, aspectRatio: '1', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Loading QR…</span>
          </div>
        )}
        {error && (
          <div style={{ width: '100%', maxWidth: 200, aspectRatio: '1', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <QrIcon size={24} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', textAlign: 'center', padding: '0 8px' }}>{error}</span>
          </div>
        )}
        {qr && (
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={qr.qr_code_base64}
                alt={`QR for ${session.subject}`}
                style={{ width: '100%', maxWidth: 200, display: 'block', borderRadius: 'var(--radius-md)', background: '#fff', padding: '8px', filter: active ? 'none' : 'grayscale(1)' }}
              />
              {!active && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em' }}>SESSION ENDED</span>
                </div>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              {active ? 'Scan this QR on your phone to mark attendance' : 'This session has ended'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Student: Sessions Tab ─────────────────────────────────────────────────────

const StudentSessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.attendance.listSessions()
      .then(setSessions)
      .catch(err => setError(err.response?.data?.detail || 'Failed to load sessions.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-muted)', padding: '24px 0' }}>Loading sessions…</p>;
  if (error)   return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  if (sessions.length === 0) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>No sessions available.</p>
      </div>
    );
  }

  // Show active sessions first
  const sorted = [...sessions].sort((a, b) => {
    const aActive = a.active && !isExpired(a.expires_at);
    const bActive = b.active && !isExpired(b.expires_at);
    return Number(bActive) - Number(aActive);
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
      {sorted.map(s => <StudentSessionCard key={s.id} session={s} />)}
    </div>
  );
};

// ─── My Attendance Tab (all users) ────────────────────────────────────────────

const MyAttendanceTab: React.FC = () => {
  const [records, setRecords] = useState<MyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.attendance.getMyAttendance()
      .then(setRecords)
      .catch(err => setError(err.response?.data?.detail || 'Failed to load attendance history.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-muted)', padding: '24px 0' }}>Loading attendance history…</p>;
  if (error)   return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  if (records.length === 0) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>No attendance records found.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {records.map(r => (
        <div key={r.id} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckIcon size={16} color="var(--color-success)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.925rem', marginBottom: '4px' }}>{r.subject}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <span><CalendarIcon size={11} /> {formatDate(r.date)}</span>
                <span><ClockIcon size={11} /> Checked in {formatDateTime(r.checked_in_at)}</span>
              </div>
            </div>
            <span className="badge badge--success" style={{ fontSize: '0.7rem' }}>Present</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isTrainer = ['admin', 'reviewer'].includes(user?.role || '');

  const tabs = isTrainer
    ? [{ id: 'sessions', label: 'Sessions' }, { id: 'my-attendance', label: 'My Attendance' }]
    : [{ id: 'sessions', label: 'Sessions' }, { id: 'my-attendance', label: 'My Attendance' }];

  const [tab, setTab] = useState('sessions');

  return (
    <div className="anim-fade-up">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 700 }}>Attendance</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {isTrainer
            ? 'Manage sessions and track student check-ins.'
            : 'Scan your personal QR code to mark attendance for each session.'}
        </p>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'sessions' && (isTrainer ? <TrainerSessionsTab /> : <StudentSessionsTab />)}
      {tab === 'my-attendance' && <MyAttendanceTab />}
    </div>
  );
};

export default AttendancePage;
