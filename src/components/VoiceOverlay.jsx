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

export default function VoiceOverlay({ 
  isActive, 
  type, 
  text, 
  transcript,
  onClose 
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [bars, setBars] = useState([]);

  // STT - bars visual
  useEffect(() => {
    if (!isActive || type !== 'stt') {
      setBars([]);
      return;
    }

    const generateBars = () => {
      const newBars = Array.from({ length: 40 }, () => ({
        height: Math.random() * 60 + 10,
        delay: Math.random() * 0.5
      }));
      setBars(newBars);
    };
    generateBars();
    const interval = setInterval(generateBars, 150);
    return () => clearInterval(interval);
  }, [isActive, type]);

  // TTS - globe visual
  useEffect(() => {
    if (!isActive || type !== 'tts' || !canvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = VOICE_COLOR_PALETTE[1];
    const [cr, cg, cb] = colors;
    
    const pulseRings = [];
    let lastPulseAt = 0;

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2 - 60;
      const now = Date.now();
      const t = now / 1000;
      
      const baseRadius = Math.min(w, h) * 0.12;
      const r = Math.max(60, baseRadius);
      const idlePulse = (Math.sin(t * 1.5) + 1) / 2;

      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.fillStyle = '#090f14';
      ctx.fillRect(0, 0, w, h);

      const glowA = 0.1 + idlePulse * 0.025;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.45);
      glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${glowA})`);
      glow.addColorStop(0.55, `rgba(${cr}, ${cg}, ${cb}, ${glowA * 0.35})`);
      glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.65, 0, Math.PI * 2);
      ctx.fill();

      if (now - lastPulseAt > 760) {
        pulseRings.push({ at: now, intensity: 0.5 });
        lastPulseAt = now;
      }

      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        const age = (now - ring.at) / 950;
        if (age >= 1) {
          pulseRings.splice(i, 1);
          continue;
        }
        const alpha = (1 - age) * (0.22 + ring.intensity * 0.24);
        const pulseRadius = r * (1.03 + age * 0.42);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.lineWidth = 1.15 + (1 - age) * 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(cx, cy);
      const rotation = t * 0.25;

      ctx.lineWidth = 1.1;
      [-0.55, 0, 0.55].forEach((lat) => {
        const ly = Math.sin(lat) * r * 0.72;
        const lxr = Math.cos(lat) * r;
        ctx.strokeStyle = `rgba(173, 186, 199, ${0.12 + idlePulse * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(0, ly, lxr, r * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      for (let i = 0; i < 5; i++) {
        const phase = rotation + (i * Math.PI) / 5;
        const width = Math.max(r * 0.12, Math.abs(Math.cos(phase)) * r);
        const alpha = 0.10 + Math.abs(Math.sin(phase)) * 0.08;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, width, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const corePulse = 0.5 + Math.sin(t * 2.2) * 0.5;
      const centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.25);
      centerGlow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.18 + corePulse * 0.06})`);
      centerGlow.addColorStop(0.55, `rgba(${cr}, ${cg}, ${cb}, 0.08)`);
      centerGlow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.16 + corePulse * 0.10})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.055, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.46 + idlePulse * 0.10})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  const isListening = type === 'stt';
  const isSpeaking = type === 'tts';
  const colors = isListening ? VOICE_COLOR_PALETTE[5] : VOICE_COLOR_PALETTE[1];
  const [cr, cg, cb] = colors;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(9, 15, 20, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      {isListening && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            height: '80px',
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}>
            {bars.map((bar, i) => (
              <div
                key={i}
                style={{
                  width: '4px',
                  height: `${bar.height}px`,
                  background: 'linear-gradient(to top, #ef4444, #f87171)',
                  borderRadius: '2px',
                  animation: `barPulse 0.4s ease-in-out ${bar.delay}s infinite alternate`,
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
                }}
              />
            ))}
          </div>
        </>
      )}
      {isSpeaking && (
        <canvas 
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1
          }}
        />
      )}

      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '24px 32px',
        background: 'rgba(9, 15, 20, 0.7)',
        borderRadius: '16px',
        border: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.3)`,
        backdropFilter: 'blur(20px)',
        minWidth: '200px'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          <X size={18} />
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: `rgb(${cr}, ${cg}, ${cb})`,
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {isListening ? <Mic size={18} /> : <Volume2 size={18} />}
          <span>{isListening ? 'Listening...' : 'Speaking...'}</span>
        </div>

        {(text || transcript) && (
          <div style={{
            textAlign: 'center',
            color: 'white',
            fontSize: '14px',
            maxWidth: '250px',
          }}>
            "{transcript || text}"
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '8px',
            padding: '8px 24px',
            background: `rgba(${cr}, ${cg}, ${cb}, 0.2)`,
            border: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.4)`,
            borderRadius: '16px',
            color: 'white',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}