import { useState, useEffect, useRef } from 'react';

// Replace http with ws for the WebSocket URL
const WS_URL = 'ws://localhost:8000';

export function useArenaSocket(lobbyId: string, token: string | null) {
    const [gameState, setGameState] = useState<any>(null);
    const [eventLogs, setEventLogs] = useState<string[]>([]);
    const [lastEventPayload, setLastEventPayload] = useState<any>(null);
    const [answerResult, setAnswerResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!lobbyId || !token) return;

        const ws = new WebSocket(`${WS_URL}/arena/ws/${lobbyId}/${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to Arena WS");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Arena Event:", data.event, data);
                if (data.state) {
                    setGameState(data.state);
                }
                if (data.event) {
                    setLastEventPayload(data);
                    setEventLogs(prev => [...prev, data.event]);
                    
                    if (data.event === "ANSWER_RESULT") {
                        setAnswerResult(data);
                    } else if (data.event === "ANSWER_CORRECT" || data.event === "PENALTY_APPLIED") {
                        setAnswerResult(null); // Clear result when moving to next turn
                    }
                    
                    if (data.event === "GAME_TERMINATED") {
                        setError("The match was ended by the trainer.");
                        setGameState(null);
                    }
                }
            } catch (err) {
                console.error("Failed to parse WS message", err);
            }
        };

        ws.onclose = (event) => {
            console.log("Disconnected from Arena WS", event.code, event.reason);
            if (event.code === 1008) {
                setError(event.reason || "Connection rejected");
            } else if (!gameState && event.code !== 1000) {
                setError("Failed to connect to the Arena. The lobby might not exist.");
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [lobbyId, token]);

    const sendEvent = (event: string, payload: any = {}) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event, ...payload }));
        }
    };

    return { gameState, eventLogs, lastEventPayload, answerResult, sendEvent, error };
}
