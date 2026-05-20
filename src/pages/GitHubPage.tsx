import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import type {
  GithubOrgsResponse, GithubRepo, GithubConfig, OrgWebhooksResponse,
  Feedback, UserInDB, PerformanceLog, CombinedFeedbackResponse,
  ProjectCollection, ProjectIngestResponse,
} from '../services/api';
import { ChevronRightIcon, RefreshIcon, PlusIcon } from '../components/ui/Icons';
import { useAuth } from '../contexts/AuthContext';
import PerformanceCharts from '../components/charts/PerformanceCharts';
import './GitHubPage.css';

type Tab = 'reviews' | 'feedback' | 'repos' | 'webhooks' | 'content';

// ── Helpers ────────────────────────────────────────────────────────────────

const langColor: Record<string, string> = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572a5',
  Java: '#b07219', 'C++': '#f34b7d', Go: '#00add8', Rust: '#dea584',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo ago`;
  return `${Math.floor(m / 12)}y ago`;
}

const scoreColor = (score: number) =>
  score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
const scoreBg = (score: number) =>
  score >= 75 ? 'rgba(62,207,142,0.15)' : score >= 50 ? 'rgba(245,176,117,0.15)' : 'rgba(235,87,87,0.15)';

// ── Ingest feedback banners ────────────────────────────────────────────────

interface IngestBannerProps { result: ProjectIngestResponse; onDismiss: () => void; }
const IngestBanner: React.FC<IngestBannerProps> = ({ result, onDismiss }) => (
  <div className="rv-ingest-banner rv-ingest-banner--success">
    <span>{result.message} <strong>({result.chunks_ingested} chunks)</strong></span>
    <button className="rv-ingest-banner__close" onClick={onDismiss}>×</button>
  </div>
);

interface IngestErrorProps { message: string; }
const IngestError: React.FC<IngestErrorProps> = ({ message }) => (
  <div className="rv-ingest-banner rv-ingest-banner--error">{message}</div>
);

// ── Repo card ──────────────────────────────────────────────────────────────

const RepoCard: React.FC<{ repo: GithubRepo }> = ({ repo }) => (
  <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="gh-repo-card">
    <div className="gh-repo-card__top">
      <span className="gh-repo-card__name">{repo.name}</span>
      <span className={`gh-repo-card__vis ${repo.private ? 'gh-repo-card__vis--private' : 'gh-repo-card__vis--public'}`}>
        {repo.private ? 'Private' : 'Public'}
      </span>
    </div>
    {repo.description && <p className="gh-repo-card__desc">{repo.description}</p>}
    <div className="gh-repo-card__meta">
      {repo.language && (
        <span className="gh-repo-card__lang">
          <span className="gh-repo-card__lang-dot" style={{ background: langColor[repo.language] ?? 'var(--color-text-muted)' }} />
          {repo.language}
        </span>
      )}
      {repo.stargazers_count > 0 && <span className="gh-repo-card__stat">★ {repo.stargazers_count}</span>}
      {repo.forks_count > 0 && <span className="gh-repo-card__stat">⑂ {repo.forks_count}</span>}
      {repo.open_issues_count > 0 && <span className="gh-repo-card__stat">● {repo.open_issues_count} issues</span>}
      {repo.updated_at && (
        <span className="gh-repo-card__stat gh-repo-card__stat--muted">Updated {timeAgo(repo.updated_at)}</span>
      )}
    </div>
  </a>
);

// ── Org section (accordion) ────────────────────────────────────────────────

interface OrgSectionProps {
  title: string;
  subtitle: string;
  repos: GithubRepo[];
  avatarUrl?: string | null;
  filter: string;
}

const OrgSection: React.FC<OrgSectionProps> = ({ title, subtitle, repos, avatarUrl, filter }) => {
  const [open, setOpen] = useState(true);
  const visible = useMemo(() => {
    if (!filter.trim()) return repos;
    const q = filter.toLowerCase();
    return repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.language?.toLowerCase().includes(q)
    );
  }, [repos, filter]);

  return (
    <div className="gh-section card">
      <button className="gh-section__header" onClick={() => setOpen(o => !o)}>
        <div className="gh-section__title-row">
          {avatarUrl
            ? <img src={avatarUrl} alt={title} className="gh-section__avatar" />
            : <span className="gh-section__avatar gh-section__avatar--placeholder">{title.charAt(0).toUpperCase()}</span>
          }
          <div>
            <span className="gh-section__name">{title}</span>
            <span className="gh-section__sub">{subtitle}</span>
          </div>
        </div>
        <span className="gh-section__chevron" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <ChevronRightIcon size={15} />
        </span>
      </button>
      {open && (
        <div className="gh-section__body">
          {visible.length === 0
            ? <div className="gh-empty">{filter ? 'No repos match your filter.' : 'No repositories found.'}</div>
            : <div className="gh-repo-grid">{visible.map(r => <RepoCard key={r.id} repo={r} />)}</div>
          }
        </div>
      )}
    </div>
  );
};

// ── Org allow-list settings panel ─────────────────────────────────────────

interface SettingsPanelProps {
  data: GithubOrgsResponse;
  onClose: () => void;
  onSaved: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ data, onClose, onSaved }) => {
  const [allowAll, setAllowAll] = useState(() => data.allowed_orgs.length === 0);
  const [draft, setDraft] = useState<Set<string>>(() =>
    data.allowed_orgs.length === 0
      ? new Set(data.orgs.map(o => o.login))
      : new Set(data.allowed_orgs)
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (login: string) =>
    setDraft(p => { const n = new Set(p); n.has(login) ? n.delete(login) : n.add(login); return n; });

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.github.updateAllowedOrgs(allowAll ? [] : Array.from(draft));
      onSaved();
    } catch { setErr('Failed to save settings.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="gh-settings card">
      <div className="gh-settings__header">
        <h3 className="gh-settings__title">Org Access Control</h3>
        <p className="gh-settings__desc">
          {allowAll
            ? 'All organisations are visible.'
            : `${draft.size} of ${data.orgs.length} org${data.orgs.length !== 1 ? 's' : ''} selected.`
          }
        </p>
      </div>

      <label className="gh-settings__allow-all">
        <input type="checkbox" checked={allowAll} onChange={e => {
          setAllowAll(e.target.checked);
          if (e.target.checked) setDraft(new Set(data.orgs.map(o => o.login)));
        }} />
        <span>Allow all organisations (no restriction)</span>
      </label>

      {!allowAll && (
        <>
          <div className="gh-settings__bulk-btns">
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft(new Set(data.orgs.map(o => o.login)))}>Select all</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft(new Set())}>Clear all</button>
          </div>
          <div className="gh-settings__org-list">
            {data.orgs.length === 0 && <div className="gh-empty">No organisations found.</div>}
            {data.orgs.map(org => (
              <label key={org.login} className="gh-settings__org-row">
                <input type="checkbox" checked={draft.has(org.login)} onChange={() => toggle(org.login)} />
                {org.avatar_url
                  ? <img src={org.avatar_url} alt={org.login} className="gh-settings__org-avatar" />
                  : <span className="gh-settings__org-avatar gh-settings__org-avatar--placeholder">{org.login.charAt(0).toUpperCase()}</span>
                }
                <div className="gh-settings__org-info">
                  <span className="gh-settings__org-name">{org.login}</span>
                  {org.description && <span className="gh-settings__org-desc">{org.description}</span>}
                </div>
                <span className="gh-settings__org-badge">
                  {org.is_allowed ? `${org.repos_count} repos` : 'blocked'}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {err && <div className="gh-settings__msg gh-settings__msg--error">{err}</div>}

      <div className="gh-settings__footer">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={saving || (!allowAll && draft.size === 0)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

// ── Webhook row for a single org ───────────────────────────────────────────

interface WebhookRowProps {
  orgLogin: string;
  avatarUrl?: string | null;
  webhookUrl: string;
}

const WebhookRow: React.FC<WebhookRowProps> = ({ orgLogin, avatarUrl, webhookUrl }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [hookData, setHookData] = useState<OrgWebhooksResponse | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading'); setActionMsg('');
    try {
      const d = await api.github.listOrgWebhooks(orgLogin);
      setHookData(d);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMsg(typeof detail === 'string' ? detail : 'Failed to load webhooks.');
    } finally { setStatus('done'); }
  }, [orgLogin]);

  useEffect(() => { load(); }, [load]);

  const install = async () => {
    setActing(true); setActionMsg('');
    try {
      const res = await api.github.installOrgWebhook(orgLogin);
      setActionMsg(res.already_existed ? 'Already installed.' : 'Webhook installed!');
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMsg(typeof detail === 'string' ? detail : 'Install failed.');
    } finally { setActing(false); }
  };

  const remove = async (hookId: number) => {
    if (!window.confirm(`Remove webhook from ${orgLogin}?`)) return;
    setActing(true); setActionMsg('');
    try {
      await api.github.removeOrgWebhook(orgLogin, hookId);
      setActionMsg('Webhook removed.');
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionMsg(typeof detail === 'string' ? detail : 'Remove failed.');
    } finally { setActing(false); }
  };

  const ourHook = hookData?.our_hook ?? null;
  const isInstalled = Boolean(ourHook);

  return (
    <div className="gh-wh-row card">
      <div className="gh-wh-row__left">
        {avatarUrl
          ? <img src={avatarUrl} alt={orgLogin} className="gh-wh-row__avatar" />
          : <span className="gh-wh-row__avatar gh-wh-row__avatar--placeholder">{orgLogin.charAt(0).toUpperCase()}</span>
        }
        <div className="gh-wh-row__info">
          <span className="gh-wh-row__name">{orgLogin}</span>
          {status === 'loading' && <span className="gh-wh-row__status gh-wh-row__status--loading">Checking…</span>}
          {status === 'done' && (
            <span className={`gh-wh-row__status ${isInstalled ? 'gh-wh-row__status--ok' : 'gh-wh-row__status--off'}`}>
              {isInstalled ? '● Webhook active' : '○ Not installed'}
            </span>
          )}
          {actionMsg && <span className="gh-wh-row__msg">{actionMsg}</span>}
        </div>
      </div>

      <div className="gh-wh-row__actions">
        {status === 'done' && !isInstalled && (
          <button className="btn btn-primary btn-sm" onClick={install} disabled={acting || !webhookUrl}>
            {acting ? 'Installing…' : 'Install'}
          </button>
        )}
        {status === 'done' && isInstalled && ourHook && (
          <button className="btn btn-sm gh-wh-remove-btn" onClick={() => remove(ourHook.id)} disabled={acting}>
            {acting ? 'Removing…' : 'Remove'}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={status === 'loading'}>
          <RefreshIcon size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Webhooks tab panel ─────────────────────────────────────────────────────

interface WebhooksTabProps {
  data: GithubOrgsResponse;
}

const WebhooksTab: React.FC<WebhooksTabProps> = ({ data }) => {
  const [config, setConfig] = useState<GithubConfig | null>(null);
  const [tunnelInput, setTunnelInput] = useState('');
  const [savingTunnel, setSavingTunnel] = useState(false);
  const [tunnelMsg, setTunnelMsg] = useState('');

  useEffect(() => {
    api.github.getConfig().then(c => {
      setConfig(c);
      setTunnelInput(c.tunnel_url);
    }).catch(() => {});
  }, []);

  const saveTunnel = async () => {
    setSavingTunnel(true); setTunnelMsg('');
    try {
      const res = await api.github.updateTunnelUrl(tunnelInput.trim());
      setConfig(prev => prev ? { ...prev, tunnel_url: res.tunnel_url, webhook_url: res.webhook_url } : null);
      setTunnelMsg('Saved!');
    } catch { setTunnelMsg('Failed to save.'); }
    finally { setSavingTunnel(false); }
  };

  const allowedOrgs = data.orgs.filter(o => o.is_allowed);
  const webhookUrl = config?.webhook_url ?? '';

  return (
    <div className="gh-wh-tab">
      <div className="gh-wh-tunnel card">
        <h3 className="gh-wh-tunnel__title">Cloudflared Tunnel</h3>
        <p className="gh-wh-tunnel__desc">
          Run <code>cloudflared tunnel --url http://localhost:8000</code> to get a public URL,
          then paste it below. The app registers webhooks pointing to <code>{'{tunnel}/webhook'}</code>.
        </p>

        {config?.tunnel_from_env && (
          <div className="gh-wh-tunnel__env-note">
            TUNNEL_URL is set via environment variable — DB value is ignored.
          </div>
        )}

        <div className="gh-wh-tunnel__row">
          <input
            type="text"
            className="form-input"
            placeholder="https://xxxx.trycloudflare.com"
            value={tunnelInput}
            onChange={e => setTunnelInput(e.target.value)}
            disabled={config?.tunnel_from_env}
            style={{ flex: 1, fontSize: '0.875rem' }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={saveTunnel}
            disabled={savingTunnel || !tunnelInput.trim() || config?.tunnel_from_env}
          >
            {savingTunnel ? 'Saving…' : 'Save'}
          </button>
        </div>

        {tunnelMsg && <div className="gh-wh-tunnel__msg">{tunnelMsg}</div>}

        {webhookUrl && (
          <div className="gh-wh-tunnel__url-display">
            <span className="gh-wh-tunnel__url-label">Webhook endpoint:</span>
            <code className="gh-wh-tunnel__url-val">{webhookUrl}</code>
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Organisation Webhooks</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {allowedOrgs.length} allowed org{allowedOrgs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {!webhookUrl && (
          <div className="gh-wh-no-url card">
            Configure a tunnel URL above before installing webhooks.
          </div>
        )}

        {allowedOrgs.length === 0 && (
          <div className="gh-empty" style={{ paddingTop: '32px' }}>
            No allowed organisations. Switch to <strong>Repositories</strong> and use <strong>Manage Org Access</strong> to allow some.
          </div>
        )}

        <div className="gh-wh-list">
          {allowedOrgs.map(org => (
            <WebhookRow
              key={org.login}
              orgLogin={org.login}
              avatarUrl={org.avatar_url}
              webhookUrl={webhookUrl}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

const GitHubPage: React.FC = () => {
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<Tab>('reviews');

  // ── GitHub / Repos state ──
  const [ghData, setGhData] = useState<GithubOrgsResponse | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const ghLoaded = useRef(false);

  // ── Manual Feedback state ──
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([]);
  const [cohortLogs, setCohortLogs] = useState<PerformanceLog[]>([]);
  const [fbLoading, setFbLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<UserInDB[]>([]);
  const [fbTargetUserId, setFbTargetUserId] = useState('');
  const [fbPrNumber, setFbPrNumber] = useState('');
  const [fbContent, setFbContent] = useState('');
  const [formError, setFormError] = useState('');

  // ── PR Reviews (combined) state ──
  const [combinedData, setCombinedData] = useState<CombinedFeedbackResponse | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);

  // ── Evaluation Content state ──
  const [collections, setCollections] = useState<ProjectCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);
  const [ingestMode, setIngestMode] = useState<'text' | 'file'>('text');
  const [ingestTopic, setIngestTopic] = useState('');
  const [ingestSource, setIngestSource] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingestSubmitting, setIngestSubmitting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<ProjectIngestResponse | null>(null);
  const [ingestError, setIngestError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Initial data load ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const idToUse = user._id || user.email;
    (async () => {
      try {
        const [fbData, perfData] = await Promise.all([
          api.feedback.listFeedback(idToUse),
          api.performance.getPerformance(idToUse),
        ]);
        setFeedbacks(Array.isArray(fbData) ? fbData : []);
        setPerfLogs(Array.isArray(perfData) ? perfData : []);
      } catch {}
      finally { setFbLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !isTrainer) return;
    (async () => {
      try {
        const allUsers = await api.users.listUsers(0, 100);
        const results = await Promise.allSettled(
          allUsers.filter(u => u._id && u._id !== user._id)
            .map(u => api.performance.getPerformance(u._id!))
        );
        const combined: PerformanceLog[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) combined.push(...r.value);
        }
        setCohortLogs(combined);
      } catch {}
    })();
  }, [user, isTrainer]);

  // ── Load combined reviews when tab is activated ──

  useEffect(() => {
    if (activeTab !== 'reviews' || combinedData !== null) return;
    if (!user) return;
    const idToUse = user._id || user.email;
    setCombinedLoading(true);
    api.feedback.getCombinedFeedback(idToUse)
      .then(d => setCombinedData(d))
      .catch(() => setCombinedData({ performances: [], feedbacks: [] }))
      .finally(() => setCombinedLoading(false));
  }, [activeTab, combinedData, user]);

  // ── Load GitHub data when repos/webhooks tab is activated ──

  const loadGh = useCallback(async () => {
    setGhLoading(true); setGhError('');
    try {
      setGhData(await api.github.listOrgsAndRepos());
      ghLoaded.current = true;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setGhError(typeof detail === 'string' ? detail : 'Failed to load GitHub data.');
    } finally { setGhLoading(false); }
  }, []);

  useEffect(() => {
    if ((activeTab === 'repos' || activeTab === 'webhooks') && !ghLoaded.current) {
      loadGh();
    }
  }, [activeTab, loadGh]);

  // ── Load collections when content tab is activated ──

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const data = await api.projectContent.listCollections();
      setCollections(data.collections ?? []);
      setCollectionsLoaded(true);
    } catch {}
    finally { setCollectionsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'content' && !collectionsLoaded) loadCollections();
  }, [activeTab, collectionsLoaded, loadCollections]);

  // ── Collection delete ──────────────────────────────────────────────────

  const handleDeleteCollection = async (topic: string) => {
    if (!window.confirm(`Delete all evaluation content for "${topic}"? This cannot be undone.`)) return;
    setDeletingTopic(topic);
    try {
      await api.projectContent.deleteCollection(topic);
      setCollections(prev => prev.filter(c => c.topic !== topic));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      alert(err?.response?.status === 404
        ? 'Collection not found. It may have already been deleted.'
        : (typeof detail === 'string' ? detail : 'Failed to delete collection.')
      );
    } finally { setDeletingTopic(null); }
  };

  // ── Ingest submit ──────────────────────────────────────────────────────

  const handleIngestSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIngestError(''); setIngestSuccess(null); setIngestSubmitting(true);
    try {
      let result: ProjectIngestResponse;
      if (ingestMode === 'text') {
        result = await api.projectContent.ingestText(ingestTopic, ingestContent, ingestSource || undefined);
        setIngestContent(''); setIngestSource('');
      } else {
        result = await api.projectContent.ingestFile(ingestTopic, selectedFile!);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      setIngestSuccess(result);
      setCollectionsLoaded(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 403) setIngestError('Only trainers can ingest content.');
      else setIngestError(typeof detail === 'string' ? detail : 'Failed to ingest content.');
    } finally { setIngestSubmitting(false); }
  };

  // ── Manual feedback submit ────────────────────────────────────────────

  const handleOpenForm = async () => {
    setShowForm(true);
    if (users.length === 0) {
      try { setUsers(await api.users.listUsers(0, 100)); } catch {}
    }
  };

  const handleSubmitFeedback = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fbTargetUserId || !fbPrNumber || !fbContent.trim()) return;
    setIsSubmitting(true); setFormError('');
    try {
      await api.feedback.createFeedback({
        user_id: fbTargetUserId,
        pr_number: parseInt(fbPrNumber, 10),
        content: fbContent,
      });
      setShowForm(false); setFbTargetUserId(''); setFbPrNumber(''); setFbContent('');
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403) setFormError('Only trainers can submit feedback.');
      else if (status === 401) setFormError('Your session has expired. Please log in again.');
      else setFormError(typeof detail === 'string' ? detail : 'Failed to submit feedback.');
    } finally { setIsSubmitting(false); }
  };

  // ── Derived values ─────────────────────────────────────────────────────

  const combinedFeedbacks = combinedData?.feedbacks ?? [];
  const combinedPerformances = combinedData?.performances ?? [];
  const combinedAvgScore = combinedFeedbacks.length > 0
    ? Math.round(combinedFeedbacks.reduce((s, fb) => s + (fb.score ?? 0), 0) / combinedFeedbacks.filter(fb => fb.score != null).length) || null
    : combinedPerformances.length > 0
      ? Math.round(combinedPerformances.reduce((s, p) => s + p.score, 0) / combinedPerformances.length)
      : null;

  const avgFbScore = feedbacks.length > 0
    ? Math.round(feedbacks.reduce((s, fb) => s + (fb.score ?? 0), 0) / feedbacks.filter(fb => fb.score != null).length) || null
    : null;

  const allowedOrgs = ghData?.orgs.filter(o => o.is_allowed) ?? [];
  const totalVisibleRepos = ghData
    ? ghData.personal.repos_count + allowedOrgs.reduce((s, o) => s + o.repos_count, 0)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="page-content gh-page">

      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>PR Reviews</h1>
          <p>Automated AI code review for every pull request raised in your organisation.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isTrainer && activeTab === 'feedback' && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenForm}>
              <PlusIcon size={14} /> Submit Feedback
            </button>
          )}
          {isTrainer && activeTab === 'repos' && (
            <button
              className={`btn btn-sm ${showSettings ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowSettings(s => !s)}
            >
              Manage Org Access
            </button>
          )}
          {(activeTab === 'repos' || activeTab === 'webhooks') && (
            <button className="btn btn-ghost btn-sm" onClick={loadGh} disabled={ghLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshIcon size={14} />
              {ghLoading ? 'Loading…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="rv-tab-bar" style={{ marginBottom: '20px' }}>
        <button className={`rv-tab-btn${activeTab === 'reviews' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('reviews')}>
          PR Reviews
        </button>
        <button className={`rv-tab-btn${activeTab === 'feedback' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('feedback')}>
          Trainer Feedback
        </button>
        {isTrainer && (
          <button className={`rv-tab-btn${activeTab === 'repos' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('repos')}>
            Repositories
          </button>
        )}
        {isTrainer && (
          <button className={`rv-tab-btn${activeTab === 'webhooks' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('webhooks')}>
            Webhooks
          </button>
        )}
        {isTrainer && (
          <button className={`rv-tab-btn${activeTab === 'content' ? ' rv-tab-btn--active' : ''}`} onClick={() => setActiveTab('content')}>
            Evaluation Content
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Tab: PR Reviews — automated AI feedback + performance
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reviews' && (
        combinedLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Loading PR reviews…</div>
        ) : (
          <>
            <div className="reviews-stats grid-3" style={{ marginBottom: '24px' }}>
              <div className="card card-gradient review-stat-card">
                <span className="review-stat-card__value" style={{ color: 'var(--color-info)' }}>{combinedFeedbacks.length}</span>
                <span className="review-stat-card__label">Automated Reviews</span>
              </div>
              <div className="card card-gradient review-stat-card">
                <span className="review-stat-card__value" style={{ color: 'var(--color-accent)' }}>{combinedPerformances.length}</span>
                <span className="review-stat-card__label">Performance Records</span>
              </div>
              {combinedAvgScore != null && (
                <div className="card card-gradient review-stat-card">
                  <span className="review-stat-card__value" style={{ color: scoreColor(combinedAvgScore) }}>{combinedAvgScore}</span>
                  <span className="review-stat-card__label">Average Score</span>
                </div>
              )}
            </div>

            {combinedPerformances.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h2 className="rv-section-title">Performance Records</h2>
                <div className="rv-perf-grid">
                  {combinedPerformances.map((p, ix) => (
                    <div key={ix} className="card rv-perf-card">
                      <div className="rv-perf-card__score" style={{ color: scoreColor(p.score) }}>{p.score}</div>
                      <div className="rv-perf-card__meta">
                        {p.pr_number != null && <span className="rv-perf-card__pr">PR #{p.pr_number}</span>}
                        {(p as any).pr_author_name && (
                          <span className="rv-perf-card__author">
                            {(p as any).pr_author_name}
                            {(p as any).pr_author_github && <span className="rv-perf-card__github"> @{(p as any).pr_author_github}</span>}
                          </span>
                        )}
                        {p.created_at && <span className="rv-perf-card__date">{new Date(p.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="rv-section-title">Automated Feedback</h2>
            <div className="reviews-list">
              {combinedFeedbacks.map((fb, ix) => (
                <div key={ix} className="review-card card anim-fade-up rv-combined-card" style={{ padding: '24px' }}>
                  <div className="review-card__header">
                    <div className="review-card__title-row">
                      <h3 className="review-card__title">
                        {fb.pr_number != null ? `PR #${fb.pr_number}` : 'Review'}
                        {fb.pr_author_name && (
                          <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: '13px', marginLeft: '8px' }}>
                            by {fb.pr_author_name}
                            {fb.pr_author_github && <span style={{ color: 'var(--color-text-muted)' }}> (@{fb.pr_author_github})</span>}
                          </span>
                        )}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {fb.score != null && (
                          <span className="badge" style={{ background: scoreBg(fb.score), color: scoreColor(fb.score), fontWeight: 700, fontSize: '13px' }}>
                            Score: {fb.score}
                          </span>
                        )}
                        <span className="badge rv-auto-badge">Auto</span>
                      </div>
                    </div>
                  </div>
                  {fb.summary && (
                    <div style={{ margin: '12px 0', padding: '12px 16px', background: 'rgba(0,212,170,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--color-accent)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', fontStyle: 'italic' }}>
                      {fb.summary}
                    </div>
                  )}
                  {fb.content && (
                    <div className="feedback-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fb.content}</ReactMarkdown>
                    </div>
                  )}
                  {fb.created_at && (
                    <div className="review-card__footer" style={{ marginTop: '16px' }}>
                      {new Date(fb.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
              {combinedFeedbacks.length === 0 && (
                <div className="tasks-empty">No automated PR reviews yet. Open a pull request in a watched organisation to trigger a review.</div>
              )}
            </div>
          </>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Trainer Feedback — manual feedback from trainers
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'feedback' && (
        <>
          {showForm && (
            <form onSubmit={handleSubmitFeedback} className="card anim-fade-up" style={{ marginBottom: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-light)', fontSize: '1.1rem' }}>Submit Feedback for a PR</h3>
              {formError && <div className="login-error">{formError}</div>}
              <div className="form-group">
                <label>Developer</label>
                <select required value={fbTargetUserId} onChange={e => setFbTargetUserId(e.target.value)} className="form-input" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px' }}>
                  <option value="">Select a user…</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>PR Number</label>
                <input type="number" required min="1" value={fbPrNumber} onChange={e => setFbPrNumber(e.target.value)} className="form-input" placeholder="42" />
              </div>
              <div className="form-group">
                <label>Feedback</label>
                <textarea required value={fbContent} onChange={e => setFbContent(e.target.value)} className="form-input" placeholder="Write your code review feedback…" style={{ minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          )}

          <PerformanceCharts logs={perfLogs} cohortLogs={cohortLogs} />

          <div className="reviews-stats grid-3" style={{ marginBottom: '24px' }}>
            <div className="card card-gradient review-stat-card">
              <span className="review-stat-card__value" style={{ color: 'var(--color-info)' }}>{feedbacks.length}</span>
              <span className="review-stat-card__label">Total Feedbacks Received</span>
            </div>
            {avgFbScore != null && (
              <div className="card card-gradient review-stat-card">
                <span className="review-stat-card__value" style={{ color: scoreColor(avgFbScore) }}>{avgFbScore}</span>
                <span className="review-stat-card__label">Average Score</span>
              </div>
            )}
          </div>

          {fbLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Loading feedback…</div>
          ) : (
            <div className="reviews-list">
              {feedbacks.map((fb, ix) => (
                <div key={fb._id || ix} className="review-card card anim-fade-up" style={{ padding: '24px' }}>
                  <div className="review-card__header">
                    <div className="review-card__title-row">
                      <h3 className="review-card__title">PR #{fb.pr_number}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {fb.score != null && (
                          <span className="badge" style={{ background: scoreBg(fb.score), color: scoreColor(fb.score), fontWeight: 700, fontSize: '13px' }}>Score: {fb.score}</span>
                        )}
                        <span className="badge badge-info">Feedback</span>
                      </div>
                    </div>
                  </div>
                  <div className="review-card__meta" style={{ marginTop: '12px', marginBottom: '16px' }}>
                    <div className="review-card__author">
                      <div className="review-card__avatar" style={{ background: 'var(--color-primary)' }}>{fb.reviewer_name?.charAt(0).toUpperCase() || '?'}</div>
                      <span>Reviewed by {fb.reviewer_name}</span>
                    </div>
                  </div>
                  {fb.summary && (
                    <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(30,58,138,0.08)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary-light)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', fontStyle: 'italic' }}>
                      {fb.summary}
                    </div>
                  )}
                  <div className="feedback-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{fb.content}</ReactMarkdown>
                  </div>
                  <div className="review-card__footer" style={{ marginTop: '16px' }}>
                    {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : 'System'}
                  </div>
                </div>
              ))}
              {feedbacks.length === 0 && <div className="tasks-empty">No feedback found. Looks good!</div>}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Repositories — browse orgs and repos
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'repos' && isTrainer && (
        <>
          {ghError && <div className="gh-error card">{ghError}</div>}
          {ghLoading && !ghData && <div className="gh-loading">Loading GitHub data…</div>}

          {ghData && (
            <>
              {showSettings && (
                <SettingsPanel
                  data={ghData}
                  onClose={() => setShowSettings(false)}
                  onSaved={() => { setShowSettings(false); loadGh(); }}
                />
              )}

              <div className="gh-meta-bar">
                <div className="gh-meta-chip">
                  <span className="gh-meta-chip__val">{ghData.user.login}</span>
                  <span className="gh-meta-chip__lbl">authenticated as</span>
                </div>
                <div className="gh-meta-chip">
                  <span className="gh-meta-chip__val">{ghData.allowed_count}/{ghData.total_orgs}</span>
                  <span className="gh-meta-chip__lbl">orgs visible</span>
                </div>
                <div className="gh-meta-chip">
                  <span className="gh-meta-chip__val">{totalVisibleRepos}</span>
                  <span className="gh-meta-chip__lbl">repos shown</span>
                </div>
                <input
                  type="text"
                  className="form-input gh-filter"
                  placeholder="Filter repos…"
                  value={repoFilter}
                  onChange={e => setRepoFilter(e.target.value)}
                />
              </div>

              <div className="gh-sections">
                <OrgSection
                  title={ghData.personal.login}
                  subtitle={`${ghData.personal.repos_count} personal repo${ghData.personal.repos_count !== 1 ? 's' : ''}`}
                  repos={ghData.personal.repos}
                  avatarUrl={ghData.user.avatar_url}
                  filter={repoFilter}
                />
                {allowedOrgs.map(org => (
                  <OrgSection
                    key={org.login}
                    title={org.login}
                    subtitle={`${org.repos_count} repo${org.repos_count !== 1 ? 's' : ''}${org.description ? ` · ${org.description}` : ''}`}
                    repos={org.repos}
                    avatarUrl={org.avatar_url}
                    filter={repoFilter}
                  />
                ))}
                {ghData.orgs.length > 0 && allowedOrgs.length === 0 && (
                  <div className="card gh-blocked-notice">
                    All organisations are blocked. Use <strong>Manage Org Access</strong> to allow some.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Webhooks — tunnel config + per-org webhook install
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'webhooks' && isTrainer && (
        <>
          {ghError && <div className="gh-error card">{ghError}</div>}
          {ghLoading && !ghData && <div className="gh-loading">Loading GitHub data…</div>}
          {ghData && <WebhooksTab data={ghData} />}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Evaluation Content — ingest rubrics for PR review RAG
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'content' && isTrainer && (
        <div className="rv-content-tab">
          <div className="card rv-ingest-card">
            <div className="rv-ingest-card__header">
              <div>
                <h3 className="rv-ingest-card__title">Add Evaluation Content</h3>
                <p className="rv-ingest-card__desc">Add rubrics, expected patterns, or grading criteria used by the AI reviewer.</p>
              </div>
              <div className="rv-mode-toggle">
                <button
                  type="button"
                  className={`rv-mode-btn${ingestMode === 'text' ? ' rv-mode-btn--active' : ''}`}
                  onClick={() => { setIngestMode('text'); setIngestError(''); setIngestSuccess(null); }}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  className={`rv-mode-btn${ingestMode === 'file' ? ' rv-mode-btn--active' : ''}`}
                  onClick={() => { setIngestMode('file'); setIngestError(''); setIngestSuccess(null); }}
                >
                  Upload File
                </button>
              </div>
            </div>

            {ingestSuccess && <IngestBanner result={ingestSuccess} onDismiss={() => setIngestSuccess(null)} />}
            {ingestError && <IngestError message={ingestError} />}

            <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>Project Topic <span className="rv-required">*</span></label>
                <input
                  type="text" required value={ingestTopic}
                  onChange={e => setIngestTopic(e.target.value)}
                  className="form-input" placeholder="e.g. Flask REST API, React Basics"
                />
              </div>

              {ingestMode === 'text' ? (
                <>
                  <div className="form-group">
                    <label>Evaluation Content <span className="rv-required">*</span></label>
                    <textarea
                      required value={ingestContent}
                      onChange={e => setIngestContent(e.target.value)}
                      className="form-input rv-content-textarea"
                      placeholder="Paste rubric, expected patterns, or reference material here."
                    />
                  </div>
                  <div className="form-group">
                    <label>Source Label</label>
                    <input
                      type="text" value={ingestSource}
                      onChange={e => setIngestSource(e.target.value)}
                      className="form-input" placeholder="e.g. rubric_v2, lecture_notes (optional)"
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Upload File <span className="rv-required">*</span></label>
                  <div className="rv-file-drop">
                    <input
                      ref={fileInputRef} type="file" required accept=".pdf,.md,.txt"
                      className="rv-file-input"
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="rv-file-drop__inner">
                      {selectedFile
                        ? <span className="rv-file-drop__name">{selectedFile.name}</span>
                        : <span className="rv-file-drop__placeholder">Choose file…</span>
                      }
                      <span className="rv-file-drop__hint">Allowed: .pdf, .md, .txt</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={ingestSubmitting || (ingestMode === 'file' && !selectedFile)}
                style={{ alignSelf: 'flex-end' }}
              >
                {ingestSubmitting
                  ? (ingestMode === 'text' ? 'Ingesting…' : 'Uploading…')
                  : (ingestMode === 'text' ? 'Ingest Text' : 'Upload & Ingest')
                }
              </button>
            </form>
          </div>

          <div style={{ marginTop: '32px' }}>
            <div className="rv-collections-header">
              <h2 className="rv-section-title" style={{ margin: 0 }}>Ingested Collections</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setCollectionsLoaded(false)} disabled={collectionsLoading}>
                {collectionsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {collectionsLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading collections…</div>
            ) : collections.length === 0 ? (
              <div className="tasks-empty">No evaluation content ingested yet.</div>
            ) : (
              <div className="rv-collections-table-wrap card" style={{ padding: 0 }}>
                <table className="rv-collections-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Collection</th>
                      <th style={{ textAlign: 'right' }}>Chunks Stored</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map(col => (
                      <tr key={col.topic}>
                        <td className="rv-col-topic">{col.topic}</td>
                        <td><span className="rv-col-collection">{col.collection}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge" style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--color-primary-light)' }}>
                            {col.document_count}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn rv-delete-btn btn-sm"
                            onClick={() => handleDeleteCollection(col.topic)}
                            disabled={deletingTopic === col.topic}
                          >
                            {deletingTopic === col.topic ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubPage;
