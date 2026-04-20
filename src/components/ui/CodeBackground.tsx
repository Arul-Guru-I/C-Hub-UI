import React, { useEffect, useRef, useMemo } from 'react';
import './CodeBackground.css';

const CODE_TOKENS = [
  'const', 'async', 'await', 'return', 'import', 'export',
  'function()', 'class {}', 'interface', 'type T =', 'Promise<T>',
  '=>', '===', '&&', '||', '?.', '??', '!==', '++',
  'useState()', 'useEffect()', '.then()', 'catch(err)',
  '.tsx', '.json', 'git push', 'npm run', 'docker run',
  '{ }', '[ ]', '</>', '/\\w+/g', 'O(n²)',
  '0x1A3F', '10110', '0b1010', '0xFF',
  'SELECT *', 'index.ts', 'new Map()', 'Array<T>',
  'try {}', 'catch {}', '#include', 'def fn():',
  'console.log', 'throw new', 'extends', 'implements',
];

const COLORS = [
  '#4f8ef7',  // electric blue
  '#00d4aa',  // electric cyan
  '#8b5cf6',  // purple
  '#38bdf8',  // light blue
  '#33e8c4',  // light teal
  '#a78bfa',  // light purple
];

// Matrix rain chars — latin + katakana + symbols for the coder aesthetic
const RAIN_CHARS = '01アイウエオカキクケコサシスセソabcdefghijklmnopqrstuvwxyz<>{}[]=>/\\|#!?+-*';

interface Token {
  id: number;
  text: string;
  baseX: number;
  baseY: number;
  depth: number;
  size: number;
  color: string;
  driftSpeed: number;
  driftPhase: number;
  driftAmp: number;
}

const CodeBackground: React.FC = () => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const tokenRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const cursorRef   = useRef<HTMLDivElement>(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const smoothRef   = useRef({ x: 0, y: 0 });
  const animRef     = useRef<number>(0);

  // Generate stable random tokens on mount
  const tokens = useMemo<Token[]>(() =>
    Array.from({ length: 36 }, (_, i) => ({
      id:          i,
      text:        CODE_TOKENS[i % CODE_TOKENS.length],
      baseX:       4 + Math.random() * 88,
      baseY:       4 + Math.random() * 88,
      depth:       0.12 + Math.random() * 0.88,
      size:        8 + Math.floor(Math.random() * 4),
      color:       COLORS[i % COLORS.length],
      driftSpeed:  0.25 + Math.random() * 0.55,
      driftPhase:  Math.random() * Math.PI * 2,
      driftAmp:    6 + Math.random() * 16,
    }))
  , []);

  // ─── Matrix rain canvas ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FONT_SIZE = 13;
    let drops: number[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.ceil(canvas.width / FONT_SIZE);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -60));
    };
    resize();
    window.addEventListener('resize', resize);

    ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;

    const draw = () => {
      // Fade trail
      ctx.fillStyle = 'rgba(6, 8, 15, 0.045)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FONT_SIZE;
        if (y < 0) { drops[i]++; continue; }

        const alpha = 0.18 + Math.random() * 0.22;
        const r     = i % 7;
        if      (r === 0) ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;   // purple
        else if (r <= 2)  ctx.fillStyle = `rgba(0, 212, 170, ${alpha})`;    // cyan
        else              ctx.fillStyle = `rgba(79, 142, 255, ${alpha})`;   // blue

        const char = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
        ctx.fillText(char, i * FONT_SIZE, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = Math.floor(Math.random() * -30);
        } else {
          drops[i]++;
        }
      }
    };

    let rafId: number;
    const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ─── Mouse parallax + sinusoidal drift (rAF, no React state) ─────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Seed smooth position at viewport center
    mouseRef.current  = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    smoothRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const tick = () => {
      // Lerp smooth mouse toward actual mouse
      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.065;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.065;

      const cx    = window.innerWidth  / 2;
      const cy    = window.innerHeight / 2;
      const normX = (smoothRef.current.x - cx) / cx;  // −1 … +1
      const normY = (smoothRef.current.y - cy) / cy;
      const t     = performance.now() / 1000;

      // Cursor orb — snaps faster to real mouse (not smooth)
      if (cursorRef.current) {
        cursorRef.current.style.left = `${mouseRef.current.x}px`;
        cursorRef.current.style.top  = `${mouseRef.current.y}px`;
      }

      // Update each floating token's transform in-place (no React re-render)
      for (let i = 0; i < tokens.length; i++) {
        const el = tokenRefs.current[i];
        if (!el) continue;
        const tk = tokens[i];
        const dx = normX * tk.depth * 42;
        const dy = normY * tk.depth * 28
                 + Math.sin(t * tk.driftSpeed + tk.driftPhase) * tk.driftAmp;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animRef.current);
    };
  }, [tokens]);

  return (
    <div className="code-bg" aria-hidden="true">
      {/* Matrix rain */}
      <canvas ref={canvasRef} className="code-bg__canvas" />

      {/* Cursor spotlight orb */}
      <div ref={cursorRef} className="code-bg__cursor-orb" />

      {/* Floating code tokens */}
      <div className="code-bg__tokens">
        {tokens.map((tk, i) => (
          <div
            key={tk.id}
            ref={el => { tokenRefs.current[i] = el; }}
            className="code-bg__token"
            style={{
              left:      `${tk.baseX}%`,
              top:       `${tk.baseY}%`,
              fontSize:  `${tk.size}px`,
              opacity:   0.02 + tk.depth * 0.08,
              color:     tk.color,
            }}
          >
            {tk.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeBackground;
