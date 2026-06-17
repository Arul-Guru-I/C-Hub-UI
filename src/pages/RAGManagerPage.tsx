import React, { useState, useEffect, useRef } from 'react';
import api, { RAGCollection } from '../services/api';
import { 
  BookOpenIcon, TrashIcon, FileIcon, SearchIcon, RefreshIcon 
} from '../components/ui/Icons';
import './RAGManagerPage.css';

interface CohortInfo {
  slug: string;
  name: string;
}

const RAGManagerPage: React.FC = () => {
  // State
  const [collections, setCollections] = useState<RAGCollection[]>([]);
  const [cohorts, setCohorts] = useState<CohortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Tab Selection: 'mcq' | 'doubt' | 'preval'
  const [activeTab, setActiveTab] = useState<'mcq' | 'doubt' | 'preval'>('mcq');
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Ingestion Form State
  const [formCategory, setFormCategory] = useState<string>('mcq');
  const [formTopic, setFormTopic] = useState('');
  const [formCohortSlug, setFormCohortSlug] = useState('');
  const [ingestMethod, setIngestMethod] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [fileSource, setFileSource] = useState('manual');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all collections and cohorts
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const collRes = await api.ragManager.listCollections();
      setCollections(collRes.collections || []);
      
      const cohortRes = await api.users.getAvailableCohorts();
      setCohorts(cohortRes || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load RAG configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter collections by search query and active tab categories
  const filteredCollections = collections.filter((col) => {
    // Determine if it matches search
    const matchesSearch = 
      col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.topic.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filter by tab
    if (activeTab === 'mcq') {
      return ['mcq', 'lp', 'lp_topic', 'arena'].includes(col.category);
    }
    if (activeTab === 'doubt') {
      return col.category === 'doubt';
    }
    if (activeTab === 'preval') {
      return col.category === 'preval';
    }
    return false;
  });

  // Derived Quick Stats
  const totalCollections = collections.length;
  const totalDocuments = collections.reduce((acc, col) => acc + col.document_count, 0);
  const doubtCollectionsCount = collections.filter(c => c.category === 'doubt').length;
  const prevalCollectionsCount = collections.filter(c => c.category === 'preval').length;

  // Handle Form Submission
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const topicClean = formTopic.trim();
    if (!topicClean) {
      setError('Topic name is required');
      return;
    }

    if (formCategory === 'lp' && !formCohortSlug) {
      setError('Cohort selection is required for Learning Path category');
      return;
    }

    if (ingestMethod === 'text' && !textContent.trim()) {
      setError('Text content is required for text ingestion');
      return;
    }

    if (ingestMethod === 'file' && !selectedFile) {
      setError('Please select a file to ingest');
      return;
    }

    setActionLoading(true);
    try {
      if (ingestMethod === 'text') {
        const res = await api.ragManager.ingestText(
          formCategory,
          topicClean,
          textContent,
          fileSource.trim() || 'manual',
          formCategory === 'lp' ? formCohortSlug : undefined
        );
        setSuccessMsg(res.message || 'Content successfully ingested.');
        setTextContent('');
      } else {
        if (selectedFile) {
          const res = await api.ragManager.ingestFile(
            formCategory,
            topicClean,
            selectedFile,
            formCategory === 'lp' ? formCohortSlug : undefined
          );
          setSuccessMsg(res.message || 'File successfully ingested.');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
      // Refresh listing
      const collRes = await api.ragManager.listCollections();
      setCollections(collRes.collections || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to ingest content');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Deletion
  const handleDelete = async (collectionName: string) => {
    const confirm = window.confirm(`Are you sure you want to delete the collection "${collectionName}"? This action is irreversible.`);
    if (!confirm) return;

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);
    try {
      const res = await api.ragManager.deleteCollection(collectionName);
      setSuccessMsg(res.message || `Deleted collection "${collectionName}" successfully`);
      // Reload collections
      const collRes = await api.ragManager.listCollections();
      setCollections(collRes.collections || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || `Failed to delete collection "${collectionName}"`);
    } finally {
      setActionLoading(false);
    }
  };

  // Clean Badge Render
  const renderCategoryBadge = (category: string) => {
    const labelMap: Record<string, string> = {
      mcq: 'MCQs & Tests',
      lp: 'LP (Cohort)',
      lp_topic: 'LP (Global)',
      arena: 'Arena',
      doubt: 'Doubt Q&A',
      preval: 'PR Review',
    };
    return (
      <span className={`collection-badge badge-${category}`}>
        {labelMap[category] || category}
      </span>
    );
  };

  return (
    <div className="rag-manager-container">
      {/* Banner */}
      <div className="rag-banner">
        <div className="rag-banner__text">
          <h1 className="rag-banner__title">RAG Manager Dashboard</h1>
          <p className="rag-banner__sub">
            Monitor, upload, and organize reference files and text corpora to power AI quiz generation, doubt answering, and automatic project code reviews.
          </p>
        </div>
        <div className="home-banner__actions">
          <button onClick={fetchData} className="btn-submit" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)' }} disabled={loading}>
            <RefreshIcon size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rag-stats">
        <div className="rag-stat-card">
          <div className="rag-stat-card__value">{totalCollections}</div>
          <div className="rag-stat-card__label">Total RAG Collections</div>
        </div>
        <div className="rag-stat-card rag-stat-card--purple">
          <div className="rag-stat-card__value">{totalDocuments}</div>
          <div className="rag-stat-card__label">Total Document Chunks</div>
        </div>
        <div className="rag-stat-card">
          <div className="rag-stat-card__value">{doubtCollectionsCount}</div>
          <div className="rag-stat-card__label">Doubt Knowledge Bases</div>
        </div>
        <div className="rag-stat-card rag-stat-card--green">
          <div className="rag-stat-card__value">{prevalCollectionsCount}</div>
          <div className="rag-stat-card__label">PR Evaluation Bases</div>
        </div>
      </div>

      {/* Action Messages */}
      {error && <div className="rag-error-msg">{error}</div>}
      {successMsg && <div className="rag-success-msg">{successMsg}</div>}

      <div className="rag-layout">
        {/* Collections Table Section */}
        <div className="rag-table-card">
          <div className="tabs-header-row">
            <div className="rag-tabs">
              <button 
                onClick={() => { setActiveTab('mcq'); setSearchQuery(''); }} 
                className={`rag-tab-btn ${activeTab === 'mcq' ? 'rag-tab-btn--active' : ''}`}
              >
                MCQs & Curriculum
              </button>
              <button 
                onClick={() => { setActiveTab('doubt'); setSearchQuery(''); }} 
                className={`rag-tab-btn ${activeTab === 'doubt' ? 'rag-tab-btn--active' : ''}`}
              >
                Student Doubts
              </button>
              <button 
                onClick={() => { setActiveTab('preval'); setSearchQuery(''); }} 
                className={`rag-tab-btn ${activeTab === 'preval' ? 'rag-tab-btn--active' : ''}`}
              >
                Project Evaluation
              </button>
            </div>
            
            <div className="search-input-wrapper">
              <input 
                type="text" 
                placeholder="Search collections..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {loading ? (
            <div className="rag-loading">
              <RefreshIcon size={32} className="sidebar__logo-icon" style={{ animation: 'breathe 2s infinite' }} />
              <span style={{ marginTop: '12px' }}>Loading vector space configuration...</span>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="rag-empty">
              No RAG collections found in this category.
            </div>
          ) : (
            <table className="rag-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Category</th>
                  <th>Collection Name</th>
                  <th>Chunk Count</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollections.map((col) => (
                  <tr key={col.name}>
                    <td style={{ fontWeight: 600 }}>{col.topic}</td>
                    <td>{renderCategoryBadge(col.category)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      {col.name}
                    </td>
                    <td>{col.document_count} chunks</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(col.name)}
                        className="btn-delete"
                        disabled={actionLoading}
                      >
                        <TrashIcon size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upload/Ingest Form Panel */}
        <div className="rag-panel">
          <h2 className="rag-panel__title">Ingest RAG Knowledge</h2>
          <form onSubmit={handleIngest}>
            
            <div className="form-group">
              <label className="form-label">Destination Category</label>
              <select 
                value={formCategory} 
                onChange={(e) => {
                  setFormCategory(e.target.value);
                  // Default reset cohort if not lp
                  if (e.target.value !== 'lp') setFormCohortSlug('');
                }} 
                className="form-select"
              >
                <option value="mcq">MCQs & General Tests (mcq_)</option>
                <option value="doubt">Student Coding Doubts (doubt_)</option>
                <option value="preval">PR Reviews / Evaluation (preval_)</option>
                <option value="lp">Learning Path - Cohort Scoped (lp_)</option>
                <option value="lp_topic">Learning Path - Global Topic (lp_topic_)</option>
              </select>
            </div>

            {formCategory === 'lp' && (
              <div className="form-group">
                <label className="form-label">Target Cohort</label>
                <select 
                  value={formCohortSlug} 
                  onChange={(e) => setFormCohortSlug(e.target.value)} 
                  className="form-select"
                >
                  <option value="">-- Select Cohort --</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.slug} value={cohort.slug}>
                      {cohort.name} ({cohort.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Topic / Skill Slug</label>
              <input 
                type="text" 
                placeholder="e.g. spring_boot, react_hooks"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ingestion Mode</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setIngestMethod('text')} 
                  className={`rag-tab-btn ${ingestMethod === 'text' ? 'rag-tab-btn--active' : ''}`}
                  style={{ flex: 1, padding: '8px 0', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Direct Text
                </button>
                <button 
                  type="button" 
                  onClick={() => setIngestMethod('file')} 
                  className={`rag-tab-btn ${ingestMethod === 'file' ? 'rag-tab-btn--active' : ''}`}
                  style={{ flex: 1, padding: '8px 0', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Document File
                </button>
              </div>
            </div>

            {ingestMethod === 'text' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Content Source Label</label>
                  <input 
                    type="text" 
                    placeholder="e.g. manual, oracle_docs"
                    value={fileSource}
                    onChange={(e) => setFileSource(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Text Content</label>
                  <textarea 
                    placeholder="Paste textbook page, API docs, code snippet, or curriculum text..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="form-textarea"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">Upload File</label>
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="file-upload-area"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }} 
                    accept=".pdf,.md,.txt,.py,.java,.js,.ts"
                  />
                  {selectedFile ? (
                    <div className="file-upload-area__selected">
                      <FileIcon size={20} />
                      {selectedFile.name}
                    </div>
                  ) : (
                    <>
                      <div className="file-upload-area__icon">
                        <FileIcon size={28} />
                      </div>
                      <div className="file-upload-area__text">
                        Click to upload a document
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Supports PDF, MD, TXT, PY, JAVA, JS, TS
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="btn-submit"
              disabled={actionLoading}
            >
              <BookOpenIcon size={16} />
              {actionLoading ? 'Ingesting Chunks...' : 'Store in Vector DB'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RAGManagerPage;
