import { useEffect, useRef, useState } from 'react';
import { X, Mic, Volume2 } from 'lucide-react';

const VOICE_COLOR_PALETTE = [
    [85, 216, 206],
    [155, 89, 182],
    [52, 152, 219],
    [80, 210, 130],
    [230, 150, 50],
    [233, 80, 155],
];

export default function VoiceOverlay({ isActive, type, text, transcript, onClose }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [bars, setBars] = useState([]);

  // STT bars
  useEffect(() => {
    if (!isActive || type !== 'stt') {
      setBars([]);
      return;
    }
    const generate = () => {
      setBars(Array.from({ length: 24 }, () => ({
        height: Math.random() * 36 + 6,
        delay: Math.random() * 0.5
      })));
    };
    generate();
    const id = setInterval(generate, 150);
    return () => clearInterval(id);
  }, [isActive, type]);

  // TTS globe canvas — compact
  useEffect(() => {
    if (!isActive || type !== 'tts') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    // Set canvas buffer to the CSS size × dpr
    const cssW = canvas.offsetWidth || 280;
    const cssH = canvas.offsetHeight || 150;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const colors = VOICE_COLOR_PALETTE[1];
    const [cr, cg, cb] = colors;
    const pulseRings = [];
    let lastPulseAt = 0;

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const now = Date.now();
      const t = now / 1000;

      const r = Math.min(w, h) * 0.28;
      const idlePulse = (Math.sin(t * 1.5) + 1) / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Ambient glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
      glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.13)`);
      glow.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, 0.04)`);
      glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Pulse rings
      if (now - lastPulseAt > 760) {
        pulseRings.push({ at: now, intensity: 0.5 });
        lastPulseAt = now;
      }
      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        const age = (now - ring.at) / 950;
        if (age >= 1) { pulseRings.splice(i, 1); continue; }
        const alpha = (1 - age) * 0.35;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.lineWidth = 1 + (1 - age) * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.03 + age * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Globe wireframe
      ctx.save();
      ctx.translate(cx, cy);
      const rot = t * 0.25;

      // Latitude lines
      ctx.lineWidth = 0.8;
      [-0.55, 0, 0.55].forEach(lat => {
        const ly = Math.sin(lat) * r * 0.72;
        const lxr = Math.cos(lat) * r;
        ctx.strokeStyle = `rgba(173, 186, 199, ${0.10 + idlePulse * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(0, ly, lxr, r * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Longitude arcs
      for (let i = 0; i < 5; i++) {
        const phase = rot + (i * Math.PI) / 5;
        const w2 = Math.max(r * 0.12, Math.abs(Math.cos(phase)) * r);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.09 + Math.abs(Math.sin(phase)) * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w2, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Core glow
      const corePulse = 0.5 + Math.sin(t * 2.2) * 0.5;
      const cg2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.28);
      cg2.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.20 + corePulse * 0.07})`);
      cg2.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = cg2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.2 + corePulse * 0.12})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outer ring
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.42 + idlePulse * 0.12})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, type]);

  if (!isActive) return null;

  const isListening = type === 'stt';
  const isSpeaking = type === 'tts';
  const colors = isListening ? VOICE_COLOR_PALETTE[5] : VOICE_COLOR_PALETTE[1];
  const [cr, cg, cb] = colors;

  const displayText = transcript || text || '';
  const truncated = displayText.length > 90 ? displayText.slice(0, 90) + '…' : displayText;

  return (
    <div style={{
      position: 'fixed',
      bottom: '110px',
      right: '24px',
      width: '280px',
      background: 'rgba(9, 15, 20, 0.94)',
      borderRadius: '20px',
      border: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.35)`,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      zIndex: 1000,
      boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(${cr}, ${cg}, ${cb}, 0.07)`,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        @keyframes dotPulse {
          0% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      {/* Close */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', zIndex: 2 }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      >
        <X size={13} />
      </button>

      {/* Globe canvas */}
      {isSpeaking && (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '150px', display: 'block' }}
        />
      )}

      {/* STT bars */}
      {isListening && (
        <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '0 24px' }}>
          {bars.map((bar, i) => (
            <div key={i} style={{
              width: '3px',
              height: `${bar.height}px`,
              background: `linear-gradient(to top, rgb(${cr}, ${cg}, ${cb}), rgba(${cr}, ${cg}, ${cb}, 0.4))`,
              borderRadius: '2px',
              animation: `barPulse 0.4s ease-in-out ${bar.delay}s infinite alternate`,
            }} />
          ))}
        </div>
      )}

      {/* Status bar */}
      <div style={{ padding: '10px 16px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.15)` }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: `rgb(${cr}, ${cg}, ${cb})`, flexShrink: 0, animation: 'dotPulse 1.4s ease-in-out infinite' }} />
        <span style={{ color: `rgb(${cr}, ${cg}, ${cb})`, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isListening ? <><Mic size={13} /> Listening...</> : <><Volume2 size={13} /> Speaking...</>}
        </span>
        <button
          onClick={onClose}
          style={{ marginLeft: 'auto', padding: '3px 10px', background: `rgba(${cr}, ${cg}, ${cb}, 0.12)`, border: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.3)`, borderRadius: '10px', color: `rgb(${cr}, ${cg}, ${cb})`, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 500 }}
          onMouseOver={e => e.currentTarget.style.background = `rgba(${cr}, ${cg}, ${cb}, 0.22)`}
          onMouseOut={e => e.currentTarget.style.background = `rgba(${cr}, ${cg}, ${cb}, 0.12)`}
        >
          Stop
        </button>
      </div>

      {/* Text preview */}
      {truncated && (
        <div style={{ padding: '0 16px 14px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, fontStyle: 'italic', borderTop: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.08)`, paddingTop: '8px' }}>
          "{truncated}"
        </div>
      )}
    </div>
  );
}
