import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Arena.css';

export default function ArenaBoard({ gameState, user, sendEvent, lastEventPayload, answerResult }: any) {
  const activePlayer = gameState.players[gameState.current_turn_index];
  const isMyTurn = activePlayer?.user_id === (user?.email || user?.name);
  const isTrainer = user?.role === 'trainer' && user?.email === gameState.trainer_id;

  const [rollingDice, setRollingDice] = useState<{ roll: number, roller: string } | null>(null);
  const [displayRoll, setDisplayRoll] = useState<number | '?'>('?');
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (lastEventPayload?.event === 'DICE_ROLLED') {
      const active = gameState.players[gameState.current_turn_index];
      setRollingDice({ roll: lastEventPayload.roll, roller: active?.email || 'Someone' });
      setIsRolling(true);
      
      const maxRoll = gameState.dice_type === '1d12' || gameState.dice_type === '2d6' ? 12 : 6;
      
      const interval = setInterval(() => {
        setDisplayRoll(Math.floor(Math.random() * maxRoll) + 1);
      }, 100);

      const t1 = setTimeout(() => {
        clearInterval(interval);
        setDisplayRoll(lastEventPayload.roll);
        setIsRolling(false);
      }, 1500);

      const t2 = setTimeout(() => {
        setRollingDice(null);
      }, 3300);

      return () => {
        clearInterval(interval);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [lastEventPayload, gameState.dice_type, gameState.players, gameState.current_turn_index]);

  return (
    <div style={{ padding: '20px' }}>
      <div className="arena-board-container">
        {/* Header */}
        <div className="arena-board-header">
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#bfdbfe' }}>Pop Quiz Arena</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>{(gameState.topics || []).join(', ')} | {gameState.board_size} Tiles</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#a1a1aa', fontSize: '1.1rem' }}>Current Turn:</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#facc15' }}>{activePlayer?.email}</p>
          </div>
        </div>

        {/* Board Grid */}
        <div className="arena-board-grid">
          {Array.from({ length: gameState.board_size }).map((_, i) => {
            const playersHere = gameState.players.filter((p:any) => p.position === i);
            const isPowerup = gameState.powerup_tiles.includes(i);
            
            const ratio = i / gameState.board_size;
            let zoneClass = '';
            if(i > 0) {
              if (ratio <= 0.3) zoneClass = 'arena-zone-green';
              else if (ratio <= 0.7) zoneClass = 'arena-zone-yellow';
              else zoneClass = 'arena-zone-red';
            }
            if (isPowerup) zoneClass = 'arena-tile-powerup';

            return (
              <div key={i} className={`arena-tile ${zoneClass}`}>
                <span className="arena-tile-number">{i}</span>
                {isPowerup && <span style={{ fontSize: '2rem', opacity: 0.8 }} title="Powerup Tile">⭐</span>}
                {i === 0 && <span style={{ fontSize: '0.7rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Start</span>}
                {i === gameState.board_size - 1 && <span style={{ fontSize: '0.7rem', color: '#eab308', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Finish</span>}
                
                <div className="arena-tokens">
                  {playersHere.map((p:any) => (
                    <motion.div 
                      key={p.user_id} 
                      layout 
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="arena-token" 
                      title={p.email}
                    >
                      {p.marker || "🔹"}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="arena-controls" style={{ position: 'relative' }}>
          
          {rollingDice && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, borderRadius: '16px' }}>
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: isRolling ? [0, 15, -15, 0] : 0 }}
                transition={{ 
                  scale: { type: "spring", bounce: 0.6, duration: 0.8 },
                  rotate: isRolling ? { repeat: Infinity, duration: 0.3 } : { duration: 0.2 }
                }}
                style={{ fontSize: '5rem', marginBottom: '16px' }}
              >
                {gameState.dice_type === '2d6' ? '🎲🎲' : '🎲'}
              </motion.div>
              <h3 style={{ fontSize: '2rem', color: '#fff', fontWeight: 'bold' }}>
                {rollingDice.roller} {isRolling ? "is rolling..." : "rolled a"} <span style={{ color: isRolling ? '#facc15' : '#4ade80', fontSize: '3rem', display: 'inline-block', width: '60px', textAlign: 'center' }}>{displayRoll}</span>{isRolling ? "" : "!"}
              </h3>
            </div>
          )}

          {gameState.winner ? (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '3rem', color: '#facc15', fontWeight: 'bold', marginBottom: '8px' }}>🎉 GAME OVER! 🎉</h3>
              <p style={{ fontSize: '1.5rem', color: '#fff' }}>{gameState.winner} reached the end!</p>
            </div>
          ) : gameState.active_question ? (
            <div style={{ width: '100%', maxWidth: '900px' }}>
              <h3 className="arena-question-title">{gameState.active_question.question}</h3>
              <div className="arena-options-grid">
                {gameState.active_question.options.map((opt:string, idx:number) => {
                  let btnStyle = {};
                  if (answerResult && idx === answerResult.correct_index) {
                    btnStyle = { background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #4ade80', color: '#4ade80' };
                  } else if (answerResult) {
                    btnStyle = { opacity: 0.5 };
                  }
                  return (
                    <button 
                      key={idx}
                      onClick={() => isMyTurn && !answerResult && sendEvent('SUBMIT_ANSWER', { selected_index: idx })}
                      disabled={!isMyTurn || !!answerResult}
                      className="arena-option-btn"
                      style={btnStyle}
                    >
                      {opt}
                      {answerResult && idx === answerResult.correct_index && <span style={{marginLeft: '8px'}}>✓</span>}
                    </button>
                  );
                })}
              </div>
              
              {answerResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: '24px', padding: '20px', background: answerResult.correct ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: answerResult.correct ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', textAlign: 'left' }}
                >
                  <h4 style={{ color: answerResult.correct ? '#4ade80' : '#f87171', fontWeight: 'bold', marginBottom: '8px', fontSize: '1.1rem' }}>
                    {answerResult.correct ? "✅ Correct!" : `❌ Incorrect! (-${answerResult.penalty} tiles)`}
                  </h4>
                  <p style={{ color: '#e2e8f0', lineHeight: 1.5 }}>
                    <strong style={{ color: '#94a3b8' }}>Explanation:</strong> {answerResult.explanation}
                  </p>
                </motion.div>
              )}

              {!isMyTurn && !answerResult && <p style={{ textAlign: 'center', marginTop: '24px', color: '#a1a1aa' }}>Waiting for {activePlayer?.email} to answer...</p>}
            </div>
          ) : gameState.pending_action ? (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '2.5rem', color: '#facc15', fontWeight: 'bold', marginBottom: '16px' }}>🌟 Action Challenge! 🌟</h3>
              <p style={{ fontSize: '1.5rem', marginBottom: '32px', background: 'rgba(0,0,0,0.4)', padding: '16px 48px', borderRadius: '50px', border: '1px solid #ca8a04', display: 'inline-block' }}>{gameState.pending_action.action}</p>
              {isTrainer ? (
                <div>
                  <button onClick={() => sendEvent('TRAINER_APPROVE_ACTION')} className="arena-btn" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '16px 40px', display: 'inline-block', width: 'auto' }}>
                    Approve Performance
                  </button>
                </div>
              ) : (
                <p style={{ color: '#a1a1aa', fontStyle: 'italic', marginTop: '8px', animation: 'pulse 2s infinite' }}>Waiting for Trainer approval...</p>
              )}
            </div>
          ) : isMyTurn ? (
            <button onClick={() => sendEvent('ROLL_DICE')} className="arena-roll-btn">
              🎲 ROLL DICE
            </button>
          ) : (
            <p style={{ fontSize: '1.5rem', color: '#71717a', fontStyle: 'italic', animation: 'pulse 2s infinite' }}>
              Waiting for {activePlayer?.email} to roll the dice...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
