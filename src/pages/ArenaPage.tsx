import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArenaSocket } from '../hooks/useArenaSocket';
import { useAuth } from '../contexts/AuthContext';
import { arenaApi } from '../services/api';
import ArenaConfigurator from '../components/arena/ArenaConfigurator';
import ArenaLobby from '../components/arena/ArenaLobby';
import ArenaBoard from '../components/arena/ArenaBoard';
import '../components/arena/Arena.css';

const ArenaPage: React.FC = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  if (!lobbyId) {
    return (
      <div className="arena-container">
        <div style={{ width: '100%', maxWidth: '960px' }}>
          <h1 className="arena-title" style={{ fontSize: '4rem', marginBottom: '40px' }}>
            Pop Quiz Arena
          </h1>
          {user?.role === 'trainer' ? (
            <ArenaConfigurator onCreated={(newId) => navigate(`/arena/${newId}`)} />
          ) : (
            <div className="arena-card" style={{ textAlign: 'center' }}>
              <h2 className="arena-title" style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Join a Match</h2>
              <p className="arena-subtitle">Enter the Lobby ID provided by your trainer:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px', margin: '0 auto' }}>
                <input 
                  type="text" 
                  placeholder="e.g. 5d9f1a23" 
                  className="arena-input"
                  style={{ textAlign: 'center', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '4px' }}
                  id="lobbyInput"
                  onKeyDown={(e) => {
                    if(e.key === 'Enter') {
                        const id = (e.target as HTMLInputElement).value;
                        if(id) navigate(`/arena/${id}`);
                    }
                  }}
                />
                <button 
                  className="arena-btn"
                  style={{ marginTop: '0' }}
                  onClick={() => {
                    const id = (document.getElementById('lobbyInput') as HTMLInputElement).value;
                    if(id) navigate(`/arena/${id}`);
                  }}
                >
                  ENTER ARENA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <ArenaActiveView lobbyId={lobbyId} user={user} />;
};

const ArenaActiveView = ({ lobbyId, user }: { lobbyId: string; user: any }) => {
  const token = user?.email || user?.name || "anonymous"; 
  const { gameState, sendEvent, lastEventPayload, answerResult, error } = useArenaSocket(lobbyId, token);

  if (error) {
    return (
      <div className="arena-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '4rem', marginBottom: '16px' }}>⚠️</span>
          <h2 style={{ fontSize: '2rem', color: '#f87171', fontWeight: 'bold', marginBottom: '8px' }}>Connection Error</h2>
          <p style={{ color: '#a1a1aa', fontSize: '1.2rem' }}>{error}</p>
          <a href="/arena" className="arena-btn" style={{ display: 'inline-block', width: 'auto', padding: '16px 32px', marginTop: '32px' }}>Return to Lobby Menu</a>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="arena-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="spinner"></div>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>Connecting to Arena...</h2>
        </div>
      </div>
    );
  }

  if (gameState.status === 'LOBBY') {
    return <ArenaLobby gameState={gameState} user={user} onStart={() => arenaApi.startGame(lobbyId)} />;
  }

  return <ArenaBoard gameState={gameState} user={user} sendEvent={sendEvent} lastEventPayload={lastEventPayload} answerResult={answerResult} />;
};

export default ArenaPage;
