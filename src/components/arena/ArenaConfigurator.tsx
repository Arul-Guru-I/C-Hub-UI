import React, { useState, useEffect, useRef } from 'react';
import { arenaApi } from '../../services/api';
import './Arena.css';

interface RagCollection {
  collection: string;
  document_count: number;
}

export default function ArenaConfigurator({ onCreated }: { onCreated: (id: string) => void }) {
  // --- Topic Selection ---
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [ragCollections, setRagCollections] = useState<RagCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // --- RAG Upload ---
  const [uploadTopic, setUploadTopic] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Board Config ---
  const [boardSize, setBoardSize] = useState(100);
  const [diceType, setDiceType] = useState('2d6');
  const [numPowerups, setNumPowerups] = useState(10);
  const [actionChallenges, setActionChallenges] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const data = await arenaApi.getRagCollections();
      setRagCollections(data);
    } catch (e) {
      console.error("Failed to fetch RAG collections", e);
    }
    setLoadingCollections(false);
  };

  const toggleCollection = (name: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(name)) return prev.filter(t => t !== name);
      if (prev.length >= 5) { alert("Maximum 5 topics allowed per match."); return prev; }
      return [...prev, name];
    });
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (!trimmed) return;
    if (selectedTopics.includes(trimmed)) { setCustomTopic(''); return; }
    if (selectedTopics.length >= 5) { alert("Maximum 5 topics allowed per match."); return; }
    setSelectedTopics(prev => [...prev, trimmed]);
    setCustomTopic('');
  };

  const removeTopic = (topic: string) => {
    setSelectedTopics(prev => prev.filter(t => t !== topic));
  };

  const handleUpload = async () => {
    if (!uploadTopic.trim() || !uploadFile) {
      alert("Please enter a topic name and select a file.");
      return;
    }
    setUploading(true);
    setUploadMessage('');
    try {
      const res = await arenaApi.uploadRagFile(uploadTopic.trim(), uploadFile);
      setUploadMessage(res.message || "Upload successful!");
      setUploadTopic('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchCollections();
    } catch (e) {
      setUploadMessage("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const createLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTopics.length === 0) {
      alert("Please select at least one topic!");
      return;
    }
    setLoading(true);
    try {
      const res = await arenaApi.createLobby({
        topics: selectedTopics,
        board_size: boardSize,
        dice_type: diceType,
        num_powerups: numPowerups
      });
      onCreated(res.lobby_id);
    } catch(err) {
      alert("Error creating lobby");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '900px' }}>

      {/* ── Section 1: RAG Document Upload ── */}
      <div className="arena-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.8rem' }}>📚</span>
          <h2 className="arena-title" style={{ fontSize: '1.8rem', margin: 0, textAlign: 'left' }}>Upload Study Material</h2>
        </div>
        <p className="arena-subtitle" style={{ textAlign: 'left', marginBottom: '24px' }}>
          Upload PDFs, Markdown, or code files to create a knowledge base for generating grounded questions.
        </p>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="arena-form-group" style={{ flex: '1 1 200px', gap: '8px' }}>
            <label className="arena-label">Collection Topic</label>
            <input
              className="arena-input"
              value={uploadTopic}
              onChange={e => setUploadTopic(e.target.value)}
              placeholder="e.g. React Hooks"
              style={{ padding: '12px 16px' }}
            />
          </div>
          <div className="arena-form-group" style={{ flex: '1 1 200px', gap: '8px' }}>
            <label className="arena-label">File (.pdf, .md, .txt, .py, .js)</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.md,.txt,.py,.java,.js,.ts"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              style={{ color: '#a1a1aa', fontSize: '0.95rem' }}
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !uploadTopic.trim() || !uploadFile}
            className="arena-btn"
            style={{ margin: 0, padding: '12px 28px', width: 'auto', fontSize: '0.95rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
          >
            {uploading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="arena-spinner-inline"></span> Chunking & Embedding...
              </span>
            ) : "Upload & Ingest"}
          </button>
        </div>
        {uploadMessage && (
          <p style={{ marginTop: '16px', color: uploadMessage.includes('fail') ? '#f87171' : '#4ade80', fontWeight: 'bold' }}>
            {uploadMessage}
          </p>
        )}
      </div>

      {/* ── Section 2: Match Configuration ── */}
      <div className="arena-card">
        <h2 className="arena-title" style={{ fontSize: '2rem' }}>Arena Match Settings</h2>
        <p className="arena-subtitle">Configure topics, board mechanics, and powerups before inviting your students.</p>

        <form onSubmit={createLobby} className="arena-form">

          {/* Topic Selection */}
          <div className="arena-form-group">
            <label className="arena-label">Select Topics (Max 5)</label>

            {/* Selected Topics Tags */}
            {selectedTopics.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {selectedTopics.map(t => (
                  <span key={t} className="arena-topic-tag">
                    {t}
                    <button type="button" onClick={() => removeTopic(t)} className="arena-topic-tag-remove">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* RAG Collections Chips */}
            <p style={{ color: '#71717a', fontSize: '0.85rem', marginBottom: '8px' }}>Available RAG Collections:</p>
            {loadingCollections ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#71717a' }}>
                <span className="arena-spinner-inline"></span> Loading collections...
              </div>
            ) : ragCollections.length === 0 ? (
              <p style={{ color: '#52525b', fontStyle: 'italic', fontSize: '0.9rem' }}>No RAG collections found. Upload documents above or type a custom topic below.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                {ragCollections.map(col => {
                  const isSelected = selectedTopics.includes(col.collection);
                  return (
                    <button
                      key={col.collection}
                      type="button"
                      onClick={() => toggleCollection(col.collection)}
                      className={`arena-collection-chip ${isSelected ? 'selected' : ''}`}
                    >
                      <span>📄 {col.collection}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{col.document_count} docs</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Topic Input */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                className="arena-input"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTopic(); } }}
                placeholder="Or type a custom topic and press Enter..."
                style={{ flex: 1, padding: '12px 16px' }}
              />
              <button type="button" onClick={addCustomTopic} className="arena-btn" style={{ margin: 0, padding: '12px 20px', width: 'auto', fontSize: '0.9rem' }}>
                Add
              </button>
            </div>
          </div>

          {/* Board & Dice */}
          <div className="arena-form-row">
            <div className="arena-form-group">
              <label className="arena-label">Board Size</label>
              <select className="arena-select" value={boardSize} onChange={e => setBoardSize(Number(e.target.value))}>
                <option value={50}>50 Tiles (Fast ~15 mins)</option>
                <option value={100}>100 Tiles (Standard ~30 mins)</option>
                <option value={200}>200 Tiles (Marathon ~1 hour)</option>
              </select>
            </div>
            <div className="arena-form-group">
              <label className="arena-label">Dice Format</label>
              <select className="arena-select" value={diceType} onChange={e => setDiceType(e.target.value)}>
                <option value="1d6">1d6 (Low Variance)</option>
                <option value="2d6">2d6 (Standard Bell Curve)</option>
                <option value="1d12">1d12 (High Chaos)</option>
              </select>
            </div>
          </div>

          {/* Powerups & Action Challenges */}
          <div className="arena-form-row" style={{ paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="arena-range-container">
              <div className="arena-range-header">
                <label className="arena-label">Powerup Tiles</label>
                <span className="arena-badge">{numPowerups} Spawned</span>
              </div>
              <input type="range" min="0" max="30" step="5" value={numPowerups} onChange={e => setNumPowerups(Number(e.target.value))} className="arena-range" />
            </div>
            <div className="arena-toggle-card" onClick={() => setActionChallenges(!actionChallenges)}>
              <div className="arena-toggle-info">
                <span className="arena-label">Action Challenges</span>
                <span className="arena-toggle-hint">Enable Sing/Dance prompts</span>
              </div>
              <div className={`arena-switch ${actionChallenges ? 'active' : 'inactive'}`}>
                <div className="arena-switch-knob"></div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || selectedTopics.length === 0} className="arena-btn">
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span className="arena-spinner-inline"></span> INITIALIZING ARENA...
              </span>
            ) : "CREATE ARENA MATCH"}
          </button>
        </form>
      </div>
    </div>
  );
}
