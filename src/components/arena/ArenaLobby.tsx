import React, { useState } from 'react';
import { arenaApi } from '../../services/api';
import './Arena.css';

export default function ArenaLobby({ gameState, user, onStart }: any) {
  const isTrainer = user?.role === 'trainer' && user?.email === gameState.trainer_id;
  const [loading, setLoading] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [reviewedSet, setReviewedSet] = useState<Set<number>>(new Set());
  const [filterBatch, setFilterBatch] = useState<number | null>(null);

  const [showGenModal, setShowGenModal] = useState(false);

  const generatePool = () => {
    setShowGenModal(true);
  };

  const triggerPoolGeneration = async (forceFresh: boolean) => {
    setShowGenModal(false);
    setLoading(true);
    try {
      const easyRes = await arenaApi.generatePool(gameState.lobby_id, "easy", 20, forceFresh);
      const mediumRes = await arenaApi.generatePool(gameState.lobby_id, "medium", 20, forceFresh);
      const hardRes = await arenaApi.generatePool(gameState.lobby_id, "hard", 20, forceFresh);
      
      const newQuestions = [...easyRes.questions, ...mediumRes.questions, ...hardRes.questions];
      setPendingQuestions(prev => [...prev, ...newQuestions]);
    } catch(err) {
      alert("Error generating questions");
    }
    setLoading(false);
  };

  const regenerateQuestion = async (index: number, difficulty: string) => {
    try {
      const res = await arenaApi.generatePool(gameState.lobby_id, difficulty, 1, false);
      if(res.questions && res.questions.length > 0) {
        setPendingQuestions(prev => {
          const newQ = [...prev];
          newQ[index] = res.questions[0];
          return newQ;
        });
        // Remove from reviewed since it's a new question
        setReviewedSet(prev => { const n = new Set(prev); n.delete(index); return n; });
      }
    } catch (e) {
      alert("Error regenerating question");
    }
  };

  const removeQuestion = (index: number) => {
    setPendingQuestions(prev => prev.filter((_, i) => i !== index));
    setReviewedSet(prev => {
      const n = new Set<number>();
      prev.forEach(i => { if (i < index) n.add(i); else if (i > index) n.add(i - 1); });
      return n;
    });
  };

  const toggleReviewed = (index: number) => {
    setReviewedSet(prev => {
      const n = new Set(prev);
      if (n.has(index)) n.delete(index); else n.add(index);
      return n;
    });
  };

  const markAllReviewed = () => {
    const visible = getFilteredQuestions();
    setReviewedSet(prev => {
      const n = new Set(prev);
      visible.forEach(({ originalIndex }) => n.add(originalIndex));
      return n;
    });
  };

  const approveQuestions = async () => {
    if(pendingQuestions.length === 0) return;
    setLoading(true);
    try {
      await arenaApi.approvePool(gameState.lobby_id, pendingQuestions);
      setPendingQuestions([]);
      setReviewedSet(new Set());
      setFilterBatch(null);
    } catch (e) {
      alert("Failed to approve questions");
    }
    setLoading(false);
  };

  // Compute unique batch numbers
  const batches = [...new Set(pendingQuestions.map(q => q.batch).filter(Boolean))].sort((a, b) => a - b);

  const getFilteredQuestions = () => {
    return pendingQuestions
      .map((q, i) => ({ ...q, originalIndex: i }))
      .filter(q => filterBatch === null || q.batch === filterBatch);
  };

  const filteredQuestions = getFilteredQuestions();
  const reviewedCount = reviewedSet.size;
  const totalCount = pendingQuestions.length;

  return (
    <div className="arena-container" style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 className="arena-title">Lobby: {gameState.lobby_id}</h2>
        <p className="arena-subtitle">Waiting for all players to join the match...</p>
        
        <div className="arena-lobby-grid">
          {/* Players Card */}
          <div className="arena-card" style={{ padding: '32px' }}>
            <h3 className="arena-label" style={{ marginBottom: '24px', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
              Players Joined ({gameState.players.length}/12)
            </h3>
            <ul className="arena-players-list">
              {gameState.players.map((p:any) => (
                <li key={p.user_id} className="arena-player-item">
                  <div className="arena-avatar">👤</div> 
                  <span style={{ fontWeight: 'bold' }}>{p.email}</span>
                </li>
              ))}
              {gameState.players.length === 0 && (
                <li style={{ color: '#71717a', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                  Waiting for players to join...
                </li>
              )}
            </ul>
          </div>
          
          {/* Trainer Dashboard */}
          {isTrainer ? (
            <div className="arena-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 className="arena-label" style={{ marginBottom: '24px', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                  Trainer Dashboard
                </h3>
                
                <div className="arena-dashboard-stat">
                  <p className="arena-label">Topics Selected</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {(gameState.topics || []).map((t: string) => (
                      <span key={t} className="arena-topic-tag">{t}</span>
                    ))}
                  </div>
                </div>
                
                <div className="arena-dashboard-stat">
                  <p className="arena-label">Questions Loaded in Game</p>
                  <p className="arena-stat-value">{gameState.pool_size}</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                <button onClick={generatePool} disabled={loading} className="arena-btn" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <span className="arena-spinner-inline"></span> Generating via AI...
                    </span>
                  ) : "Pre-generate Question Pool"}
                </button>
                <button 
                  onClick={onStart} 
                  disabled={gameState.pool_size === 0} 
                  className="arena-btn"
                  style={{ background: gameState.pool_size > 0 ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#3f3f46' }}
                >
                  Start Match
                </button>
              </div>
            </div>
          ) : (
            <div className="arena-card" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div className="spinner"></div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>Waiting for Trainer...</h3>
              <p style={{ color: '#a1a1aa' }}>The game will begin once the trainer has prepared the question pool and started the match.</p>
            </div>
          )}
        </div>

        {/* Review Questions Panel (Trainer Only) */}
        {isTrainer && pendingQuestions.length > 0 && (
          <div className="arena-card" style={{ marginTop: '32px', padding: '32px' }}>
            {/* Header with stats and actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="arena-label" style={{ fontSize: '1.2rem', margin: 0 }}>
                  Review Questions Queue ({totalCount})
                </h3>
                <p style={{ color: '#71717a', fontSize: '0.85rem', marginTop: '4px' }}>
                  ✅ {reviewedCount}/{totalCount} reviewed
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={markAllReviewed} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  ✅ Mark All Visible Reviewed
                </button>
                <button onClick={approveQuestions} disabled={loading} className="arena-btn" style={{ margin: 0, padding: '10px 24px', width: 'auto', background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '0.95rem' }}>
                  {loading ? "Approving..." : `Approve All ${totalCount} → Game`}
                </button>
              </div>
            </div>
            
            {/* Batch Filter Tabs */}
            {batches.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterBatch(null)}
                  className={`arena-collection-chip ${filterBatch === null ? 'selected' : ''}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  All ({totalCount})
                </button>
                {batches.map(b => {
                  const count = pendingQuestions.filter(q => q.batch === b).length;
                  return (
                    <button
                      key={b}
                      onClick={() => setFilterBatch(b)}
                      className={`arena-collection-chip ${filterBatch === b ? 'selected' : ''}`}
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      Batch #{b} ({count})
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Question Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filteredQuestions.map((q) => {
                const idx = q.originalIndex;
                const isReviewed = reviewedSet.has(idx);
                return (
                  <div key={idx} style={{
                    background: isReviewed ? 'rgba(34, 197, 94, 0.05)' : 'rgba(0,0,0,0.3)',
                    border: isReviewed ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '20px', position: 'relative',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                        <span className="arena-badge" style={{ fontSize: '0.7rem' }}>{q.difficulty?.toUpperCase()}</span>
                        {q.batch && <span style={{ fontSize: '0.7rem', color: '#71717a', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>B#{q.batch}</span>}
                        {isReviewed && <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>✅</span>}
                        <h4 style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#e2e8f0', margin: 0 }}>{q.question}</h4>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => toggleReviewed(idx)}
                          title={isReviewed ? "Unmark reviewed" : "Mark as reviewed"}
                          style={{ background: isReviewed ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', color: isReviewed ? '#4ade80' : '#a1a1aa', border: '1px solid ' + (isReviewed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'), padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          {isReviewed ? '✅' : '☐'}
                        </button>
                        <button onClick={() => regenerateQuestion(idx, q.difficulty || "medium")} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          ↻
                        </button>
                        <button onClick={() => removeQuestion(idx)} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {q.options?.map((opt: string, optIdx: number) => (
                        <div key={optIdx} style={{ padding: '10px 12px', borderRadius: '8px', border: optIdx === q.correct_index ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.05)', background: optIdx === q.correct_index ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)' }}>
                          <span style={{ color: optIdx === q.correct_index ? '#4ade80' : '#94a3b8', fontSize: '0.95rem' }}>
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </span>
                          {optIdx === q.correct_index && <span style={{ marginLeft: '8px', color: '#4ade80', fontSize: '0.75rem' }}>✓ Correct</span>}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(59, 130, 246, 0.05)', borderLeft: '3px solid #3b82f6', borderRadius: '0 8px 8px 0' }}>
                        <span style={{ fontSize: '0.8rem', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Explanation</span>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.4 }}>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showGenModal && (
        <div className="arena-modal-overlay">
          <div className="arena-modal-content arena-card" style={{ maxWidth: '500px', width: '90%', padding: '32px', margin: '20px' }}>
            <h3 className="arena-modal-title" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>
              Configure Question Pool
            </h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Choose how you would like to prepare the questions. Using the cache is instant, while fresh generation uses AI/RAG to parse files.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Option 1: Database cache */}
              <div 
                onClick={() => triggerPoolGeneration(false)}
                className="arena-gen-option"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ fontSize: '24px', marginTop: '2px' }}>📦</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f4f4f5', fontWeight: 'bold' }}>Pull from Cache (Fast)</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa', lineHeight: '1.4' }}>
                    Instantly load cached questions from MongoDB. Generates freshly only if there are not enough cached questions.
                  </p>
                </div>
              </div>

              {/* Option 2: Fresh generation */}
              <div 
                onClick={() => triggerPoolGeneration(true)}
                className="arena-gen-option"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ fontSize: '24px', marginTop: '2px' }}>✨</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f4f4f5', fontWeight: 'bold' }}>Generate Freshly (AI)</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa', lineHeight: '1.4' }}>
                    Bypass the cache and run the AI/RAG generation pipeline to parse documents and generate new questions.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowGenModal(false)}
                className="arena-btn"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: 'auto', padding: '8px 16px', margin: 0, fontSize: '0.9rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
