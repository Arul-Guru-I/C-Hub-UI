import React, { useState, useEffect } from 'react';
import { TrendUpIcon, MessageIcon, EyeIcon, PlusIcon, SendIcon } from '../components/ui/Icons';
import type { ForumCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { Post } from '../services/api';
import './ForumPage.css';

const CATEGORY_META: Record<ForumCategory, { label: string; cls: string }> = {
  general:       { label: 'General',       cls: 'badge-primary' },
  help:          { label: 'Help',          cls: 'badge-warning' },
  announcements: { label: 'Announcements', cls: 'badge-info'    },
  showcase:      { label: 'Showcase',      cls: 'badge-accent'  },
  feedback:      { label: 'Feedback',      cls: 'badge-danger'  },
};

type FilterCat = 'all' | ForumCategory;

const ForumPage: React.FC = () => {
  const [category, setCategory] = useState<FilterCat>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCohort, setNewCohort] = useState('');
  const [filterCohort, setFilterCohort] = useState<string>('all');
  const [cohortList, setCohortList] = useState<string[]>([]);
  const { user } = useAuth(); 
  const isTrainer = user?.role === 'admin' || user?.role === 'reviewer';

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const data = await api.forum.listPosts(0, 50, filterCohort === 'all' ? undefined : filterCohort);
      setPosts(data);
    } catch (err) {
      console.error("Failed to fetch posts", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isTrainer) {
      api.users.getAvailableCohorts().then(setCohortList).catch(console.error);
    }
  }, [isTrainer]);

  useEffect(() => {
    fetchPosts();
  }, [filterCohort]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      if (user) {
         await api.forum.createPost({ title: newTitle, content: newContent, cohort: newCohort || null });
         setIsCreating(false);
         setNewTitle('');
         setNewContent('');
         setNewCohort('');
         fetchPosts();
      }
    } catch (err) {
      console.error("Failed to create post", err);
    }
  };

  const categories: { key: FilterCat; label: string }[] = [
    { key: 'all',           label: 'All' },
    { key: 'general',       label: 'General' },
    { key: 'help',          label: 'Help' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'showcase',      label: 'Showcase' },
    { key: 'feedback',      label: 'Feedback' },
  ];

  const handlePostUpdate = (updated: Post) => {
    setPosts(prev => prev.map(p => p._id === updated._id ? updated : p));
  };

  // Since API posts don't have category, we assume all are 'general' or match 'all'
  const filtered = posts;

  return (
    <div className="page-content forum-page">
      <div className="page-header">
        <h1>Community Forum</h1>
        <p>Discuss, share, and get help from the team and community.</p>
      </div>

      <div className="forum-toolbar">
        <div className="forum-categories">
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`filter-btn ${category === cat.key ? 'filter-btn--active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isTrainer && (
            <select
              className="form-input filter-btn"
              value={filterCohort}
              onChange={e => setFilterCohort(e.target.value)}
              style={{ background: 'var(--color-surface-2)', padding: '6px 12px', border: '1px solid var(--color-border)' }}
            >
              <option value="all">All Cohorts</option>
              {cohortList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreating(!isCreating)}
          >
            <PlusIcon size={14} /> {isCreating ? 'Cancel' : 'New Thread'}
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreatePost} className="card anim-fade-up" style={{ marginBottom: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.2rem' }}>Create New Thread</h3>
          <input 
            type="text" 
            placeholder="Thread Title" 
            value={newTitle} 
            onChange={e => setNewTitle(e.target.value)} 
            className="form-input" 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}
            required 
          />
          {isTrainer && (
            <select
              className="form-input"
              value={newCohort}
              onChange={e => setNewCohort(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}
            >
              <option value="">Global (All Cohorts)</option>
              {cohortList.map(c => <option key={c} value={c}>Target: {c}</option>)}
            </select>
          )}
          <textarea 
            placeholder="What's on your mind?" 
            value={newContent} 
            onChange={e => setNewContent(e.target.value)} 
            className="form-input" 
            style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)', fontFamily: 'inherit' }}
            required 
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsCreating(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Post Thread</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-sec)' }}>Loading threads...</div>
      ) : (
        <div className="forum-section anim-slide-in">
          <div className="forum-section-label">Recent Threads</div>
          {filtered.map(t => (
            <ThreadCard key={t._id} post={t} onUpdate={handlePostUpdate} />
          ))}
          {filtered.length === 0 && (
            <div className="tasks-empty">No threads are available. Start a new one!</div>
          )}
        </div>
      )}
    </div>
  );
};

const ThreadCard: React.FC<{ post: Post; onUpdate: (updated: Post) => void }> = ({ post, onUpdate }) => {
  const catMeta = CATEGORY_META['general'];
  const { user } = useAuth();
  const isTrainer = user?.role === 'admin' || user?.role === 'reviewer';
  const [expanded, setExpanded] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !post._id) return;
    setIsReplying(true);
    try {
      const updated = await api.forum.addReply(post._id, { content: replyContent });
      setReplyContent('');
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to add reply', err);
    } finally {
      setIsReplying(false);
    }
  };

  const replyCount = post.replies?.length || 0;

  return (
    <div className="thread-card card anim-fade-up">
      <div className="thread-card__main">
        <div className="thread-card__title-row">
          <h3 className="thread-card__title">{post.title}</h3>
        </div>
        <div className="thread-card__meta">
          <div className="thread-card__author">
            <div className="thread-author-avatar" style={{ background: 'var(--color-primary)' }}>
              {post.author_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="thread-author-name">{post.author_name}</span>
          </div>
          <span className={`badge ${catMeta.cls}`}>{catMeta.label}</span>
          <span className="badge" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)' }}>
            {post.cohort ? `Cohort: ${post.cohort}` : 'Global Post'}
          </span>
          <span className="thread-card__date">
            {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}
          </span>
        </div>
        <div style={{ marginTop: '12px', color: 'var(--color-text-sec)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {post.content}
        </div>
      </div>

      <div className="thread-card__stats">
        <div className="thread-stat" title="Upvotes">
          <span className="thread-stat__icon"><TrendUpIcon size={14} /></span>
          <span className="thread-stat__value">0</span>
        </div>
        <button
          className="thread-stat thread-stat--btn"
          title="Replies"
          onClick={() => setExpanded(v => !v)}
        >
          <span className="thread-stat__icon"><MessageIcon size={14} /></span>
          <span className="thread-stat__value">{replyCount}</span>
        </button>
        <div className="thread-stat" title="Views">
          <span className="thread-stat__icon"><EyeIcon size={14} /></span>
          <span className="thread-stat__value">0</span>
        </div>
      </div>

      {expanded && (
        <div className="thread-replies">
          {post.replies && post.replies.length > 0 ? (
            <div className="thread-replies__list">
              {post.replies.map((r) => (
                <div key={r._id} className="thread-reply">
                  <div className="thread-reply__avatar" style={{ background: 'var(--color-primary-dark)' }}>
                    {r.author_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="thread-reply__body">
                    <div className="thread-reply__meta">
                      <span className="thread-reply__author">{r.author_name}</span>
                      <span className="thread-reply__date">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                    <p className="thread-reply__content">{r.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="thread-replies__empty">No replies yet. Be the first!</p>
          )}

          {user && (
            <div className="thread-reply-container" style={{ marginTop: '16px' }}>
              {(!isTrainer && post.cohort && post.cohort !== user.cohort) ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '8px' }}>
                  You cannot reply to threads scoped outside of your cohort.
                </div>
              ) : (
                <form onSubmit={handleReply} className="thread-reply-form">
                  <div className="thread-reply__avatar" style={{ background: 'var(--color-primary)' }}>
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <input
                    type="text"
                    className="form-input thread-reply-input"
                    placeholder="Write a reply…"
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isReplying}>
                    <SendIcon size={13} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ForumPage;
