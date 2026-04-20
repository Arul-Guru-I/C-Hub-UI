import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type {
  DeviceInfo,
  DevicesResponse,
  DeviceActivityResponse,
  DeviceFilesResponse,
  DashboardSummaryResponse,
} from '../services/api';
import {
  ActivityIcon,
  ClockIcon,
  FileIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
  UsersIcon,
  BarChartIcon,
  MonitorIcon,
} from '../components/ui/Icons';
import './TasksPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};

const relativeTime = (iso: string) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const EVENT_COLOR: Record<string, string> = {
  created:  'var(--color-success)',
  modified: 'var(--color-warning)',
  deleted:  'var(--color-danger)',
  moved:    'var(--color-info)',
};

const eventColor = (type: string) => EVENT_COLOR[type.toLowerCase()] ?? 'var(--color-text-muted)';

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  accent?: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, accent, icon }) => (
  <div className="dm-stat-card card">
    <div className="dm-stat-card__icon" style={{ background: accent ? `${accent}18` : 'var(--color-surface-2)' }}>
      <span style={{ color: accent ?? 'var(--color-text-secondary)' }}>{icon}</span>
    </div>
    <div className="dm-stat-card__body">
      <div className="dm-stat-card__value" style={{ color: accent ?? 'var(--color-text-primary)' }}>{value}</div>
      <div className="dm-stat-card__label">{label}</div>
    </div>
  </div>
);

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

interface Tab { id: string; label: string; icon?: React.ReactNode; }
interface TabBarProps { tabs: Tab[]; active: string; onChange: (id: string) => void; }

const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange }) => (
  <div className="dm-tab-bar">
    {tabs.map(t => (
      <button
        key={t.id}
        className={`dm-tab-btn ${active === t.id ? 'dm-tab-btn--active' : ''}`}
        onClick={() => onChange(t.id)}
      >
        {t.icon && <span className="dm-tab-btn__icon">{t.icon}</span>}
        {t.label}
      </button>
    ))}
  </div>
);

// ─── Online Dot ──────────────────────────────────────────────────────────────

const OnlineDot: React.FC<{ online: boolean }> = ({ online }) => (
  <span className={`dm-online-dot ${online ? 'dm-online-dot--online' : ''}`} />
);

// ─── Device Activity Panel ────────────────────────────────────────────────────

interface ActivityPanelProps {
  deviceId: string;
  onClose: () => void;
}

const ActivityPanel: React.FC<ActivityPanelProps> = ({ deviceId, onClose }) => {
  const [data, setData] = useState<DeviceActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.devices.getActivity(deviceId, limit);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = data?.events.filter(e =>
    search === '' || e.path.toLowerCase().includes(search.toLowerCase()) || e.event_type.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="dm-detail-panel card anim-fade-up">
      <div className="dm-detail-panel__header">
        <div>
          <div className="dm-detail-panel__title">
            <ActivityIcon size={16} color="var(--color-primary-light)" />
            Activity Timeline
          </div>
          {data && <div className="dm-detail-panel__sub">{data.student_name} · {data.total_returned} events</div>}
        </div>
        <div className="dm-detail-panel__actions">
          <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh"><RefreshIcon size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><XIcon size={14} /></button>
        </div>
      </div>

      <div className="dm-detail-panel__toolbar">
        <div className="dm-search-wrap">
          <SearchIcon size={13} color="var(--color-text-muted)" />
          <input
            className="dm-search-input"
            placeholder="Filter by path or event type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="dm-select"
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
        >
          {[25, 50, 100, 200, 500].map(n => (
            <option key={n} value={n}>Last {n}</option>
          ))}
        </select>
      </div>

      {loading && <div className="dm-loading">Loading activity…</div>}
      {error && <div className="dm-error"><AlertTriangleIcon size={14} /> {error}</div>}

      {!loading && !error && (
        <div className="dm-timeline">
          {filtered.length === 0 ? (
            <div className="dm-empty">No events match your filter.</div>
          ) : (
            filtered.map((e, i) => (
              <div key={i} className="dm-timeline-item">
                <div
                  className="dm-timeline-dot"
                  style={{ background: eventColor(e.event_type) }}
                />
                <div className="dm-timeline-body">
                  <div className="dm-timeline-path">
                    <FileIcon size={12} color="var(--color-text-muted)" />
                    <span className="dm-timeline-path-text">{e.path}</span>
                    {e.is_directory && <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 7px' }}>dir</span>}
                  </div>
                  <div className="dm-timeline-meta">
                    <span style={{ color: eventColor(e.event_type), fontWeight: 600, fontSize: '11px', textTransform: 'capitalize' }}>
                      {e.event_type}
                    </span>
                    <span className="dm-timeline-time"><ClockIcon size={11} /> {fmtTime(e.received_at)}</span>
                    {e.file_hash && (
                      <span className="dm-hash" title={e.file_hash}>#{e.file_hash.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Device Files Panel ────────────────────────────────────────────────────────

interface FilesPanelProps {
  deviceId: string;
  onClose: () => void;
}

const FilesPanel: React.FC<FilesPanelProps> = ({ deviceId, onClose }) => {
  const [data, setData] = useState<DeviceFilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.devices.getFiles(deviceId);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const allEvents = data ? [...new Set(data.files.map(f => f.last_event))] : [];

  const filtered = (data?.files ?? []).filter(f => {
    const matchSearch = search === '' || f.path.toLowerCase().includes(search.toLowerCase());
    const matchEvent = filterEvent === 'all' || f.last_event === filterEvent;
    return matchSearch && matchEvent;
  });

  return (
    <div className="dm-detail-panel card anim-fade-up">
      <div className="dm-detail-panel__header">
        <div>
          <div className="dm-detail-panel__title">
            <FileIcon size={16} color="var(--color-gold)" />
            File Snapshot
          </div>
          {data && <div className="dm-detail-panel__sub">{data.student_name} · {data.total_files} unique files</div>}
        </div>
        <div className="dm-detail-panel__actions">
          <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh"><RefreshIcon size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><XIcon size={14} /></button>
        </div>
      </div>

      <div className="dm-detail-panel__toolbar">
        <div className="dm-search-wrap">
          <SearchIcon size={13} color="var(--color-text-muted)" />
          <input
            className="dm-search-input"
            placeholder="Filter by path…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="dm-select"
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
        >
          <option value="all">All events</option>
          {allEvents.map(ev => (
            <option key={ev} value={ev}>{ev}</option>
          ))}
        </select>
      </div>

      {loading && <div className="dm-loading">Loading file snapshot…</div>}
      {error && <div className="dm-error"><AlertTriangleIcon size={14} /> {error}</div>}

      {!loading && !error && (
        <div className="dm-files-list">
          {filtered.length === 0 ? (
            <div className="dm-empty">No files match your filter.</div>
          ) : (
            filtered.map((f, i) => (
              <div key={i} className="dm-file-row">
                <div
                  className="dm-file-event-bar"
                  style={{ background: eventColor(f.last_event) }}
                />
                <FileIcon size={13} color="var(--color-text-muted)" />
                <div className="dm-file-info">
                  <div className="dm-file-path">{f.path}</div>
                  <div className="dm-file-meta">
                    <span style={{ color: eventColor(f.last_event), fontWeight: 600, fontSize: '11px', textTransform: 'capitalize' }}>
                      {f.last_event}
                    </span>
                    <span className="dm-timeline-time"><ClockIcon size={11} /> {relativeTime(f.last_seen)}</span>
                    {f.file_hash && <span className="dm-hash">#{f.file_hash.slice(0, 8)}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Device List Tab ─────────────────────────────────────────────────────────

const DevicesTab: React.FC = () => {
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [panelMode, setPanelMode] = useState<'activity' | 'files'>('activity');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.devices.listDevices());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPanel = (device: DeviceInfo, mode: 'activity' | 'files') => {
    setSelectedDevice(device);
    setPanelMode(mode);
  };
  const closePanel = () => setSelectedDevice(null);

  const filtered = (data?.devices ?? []).filter(d => {
    const matchSearch = search === '' || d.student_name.toLowerCase().includes(search.toLowerCase()) || d.ip_address.includes(search);
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="dm-devices-layout">
      {/* Left: Device list */}
      <div className={`dm-devices-main ${selectedDevice ? 'dm-devices-main--narrow' : ''}`}>
        {/* Summary row */}
        {data && (
          <div className="dm-summary-row">
            <StatCard label="Total Devices" value={data.total} icon={<UsersIcon size={18} />} />
            <StatCard label="Online" value={data.online} accent="var(--color-success)" icon={<CheckIcon size={18} />} />
            <StatCard label="Offline" value={data.offline} accent="var(--color-danger)" icon={<XIcon size={18} />} />
          </div>
        )}

        {/* Toolbar */}
        <div className="dm-toolbar">
          <div className="dm-search-wrap">
            <SearchIcon size={13} color="var(--color-text-muted)" />
            <input
              className="dm-search-input"
              placeholder="Search student or IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="dm-filter-pills">
            {(['all', 'online', 'offline'] as const).map(s => (
              <button
                key={s}
                className={`filter-btn ${statusFilter === s ? 'filter-btn--active' : ''}`}
                onClick={() => setStatusFilter(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshIcon size={13} /> Refresh
          </button>
        </div>

        {loading && <div className="dm-loading dm-loading--full">Loading devices…</div>}
        {error && <div className="dm-error"><AlertTriangleIcon size={14} /> {error}</div>}

        {!loading && !error && (
          <div className="dm-device-list">
            {filtered.length === 0 ? (
              <div className="dm-empty">No devices found.</div>
            ) : (
              filtered.map(d => {
                const isActive = selectedDevice?.device_id === d.device_id;
                return (
                  <div key={d.device_id} className={`dm-device-card card ${isActive ? 'dm-device-card--active' : ''}`}>
                    <div className="dm-device-card__left">
                      <OnlineDot online={d.status === 'online'} />
                      <div className="dm-device-card__info">
                        <div className="dm-device-card__name">{d.student_name}</div>
                        <div className="dm-device-card__meta">
                          <span className="dm-device-card__ip">{d.ip_address}</span>
                          <span className="dm-device-card__time"><ClockIcon size={11} /> {relativeTime(d.last_seen)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="dm-device-card__right">
                      <span className={`badge ${d.status === 'online' ? 'badge-success' : 'badge-muted'}`}>
                        {d.status}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="View activity"
                        onClick={() => openPanel(d, 'activity')}
                        style={{ color: isActive && panelMode === 'activity' ? 'var(--color-primary-light)' : undefined }}
                      >
                        <ActivityIcon size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="View files"
                        onClick={() => openPanel(d, 'files')}
                        style={{ color: isActive && panelMode === 'files' ? 'var(--color-gold)' : undefined }}
                      >
                        <FileIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      {selectedDevice && (
        <div className="dm-devices-panel">
          <div className="dm-panel-switcher">
            <button
              className={`dm-tab-btn ${panelMode === 'activity' ? 'dm-tab-btn--active' : ''}`}
              onClick={() => setPanelMode('activity')}
            >
              <ActivityIcon size={13} /> Activity
            </button>
            <button
              className={`dm-tab-btn ${panelMode === 'files' ? 'dm-tab-btn--active' : ''}`}
              onClick={() => setPanelMode('files')}
            >
              <FileIcon size={13} /> Files
            </button>
          </div>
          {panelMode === 'activity' ? (
            <ActivityPanel deviceId={selectedDevice.device_id} onClose={closePanel} />
          ) : (
            <FilesPanel deviceId={selectedDevice.device_id} onClose={closePanel} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Dashboard / Summary Tab ──────────────────────────────────────────────────

const SummaryTab: React.FC = () => {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.devices.getSummary());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {loading && <div className="dm-loading dm-loading--full">Loading dashboard…</div>}
      {error && <div className="dm-error"><AlertTriangleIcon size={14} /> {error}</div>}

      {!loading && !error && data && (
        <div className="dm-summary-page">
          {/* Top stats */}
          <div className="dm-summary-stats">
            <StatCard label="Total Devices"   value={data.devices.total}            icon={<UsersIcon size={18} />} />
            <StatCard label="Online"          value={data.devices.online}           accent="var(--color-success)" icon={<CheckIcon size={18} />} />
            <StatCard label="Offline"         value={data.devices.offline}          accent="var(--color-danger)"  icon={<XIcon size={18} />} />
            <StatCard label="Total Events"    value={data.file_events.total.toLocaleString()} accent="var(--color-info)" icon={<ActivityIcon size={18} />} />
          </div>

          <div className="dm-summary-grid">
            {/* Per-device event leaderboard */}
            <div className="card dm-leaderboard">
              <div className="dm-section-title"><ActivityIcon size={14} color="var(--color-primary-light)" /> Events per Device</div>
              <div className="dm-leaderboard-list">
                {data.file_events.per_device.map((d, i) => {
                  const max = data.file_events.per_device[0]?.event_count || 1;
                  const pct = Math.round((d.event_count / max) * 100);
                  return (
                    <div key={d.device_id} className="dm-lb-row">
                      <div className="dm-lb-rank">{i + 1}</div>
                      <div className="dm-lb-info">
                        <div className="dm-lb-name">{d.student_name}</div>
                        <div className="dm-lb-bar-wrap">
                          <div className="dm-lb-bar" style={{ width: `${pct}%`, background: i === 0 ? 'var(--gradient-primary)' : 'var(--color-surface-3)' }} />
                        </div>
                      </div>
                      <div className="dm-lb-count">{d.event_count.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity feed */}
            <div className="card dm-recent-feed">
              <div className="dm-section-title"><ClockIcon size={14} color="var(--color-gold)" /> Recent Activity</div>
              <div className="dm-feed-list">
                {data.recent_activity.length === 0 ? (
                  <div className="dm-empty">No recent activity.</div>
                ) : (
                  data.recent_activity.map((e, i) => (
                    <div key={i} className="dm-feed-item">
                      <div className="dm-feed-dot" style={{ background: eventColor(e.event_type) }} />
                      <div className="dm-feed-body">
                        <div className="dm-feed-student">{e.student_name}</div>
                        <div className="dm-feed-path">
                          <span style={{ color: eventColor(e.event_type), fontWeight: 600, fontSize: '11px', textTransform: 'capitalize', marginRight: 6 }}>
                            {e.event_type}
                          </span>
                          <span className="dm-feed-path-txt">{e.path}</span>
                        </div>
                        <div className="dm-feed-time"><ClockIcon size={11} /> {relativeTime(e.received_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'summary', icon: <BarChartIcon size={14} />, label: 'Dashboard' },
  { id: 'devices', icon: <MonitorIcon  size={14} />, label: 'Devices'   },
];

const TasksPage: React.FC = () => {
  const [tab, setTab] = useState('summary');

  return (
    <div className="page-content tasks-page">
      <div className="page-header">
        <h1>Device Monitor</h1>
        <p>Track student device activity, file events, and live connectivity via OpenClaw.</p>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'summary' && <SummaryTab />}
      {tab === 'devices' && <DevicesTab />}
    </div>
  );
};

export default TasksPage;
