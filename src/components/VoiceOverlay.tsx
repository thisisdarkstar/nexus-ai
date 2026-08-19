import { useEffect, useRef, useState } from 'react';
import { X, Mic, Volume2 } from 'lucide-react';
import styles from './VoiceOverlay.module.css';

const VOICE_COLOR_PALETTE: [number, number, number][] = [
  [85, 216, 206],
  [155, 89, 182],
  [52, 152, 219],
  [80, 210, 130],
  [230, 150, 50],
  [233, 80, 155],
];

interface VoiceOverlayProps {
  isActive: boolean;
  type: 'stt' | 'tts' | null;
  text: string;
  transcript: string;
  onClose: () => void;
}

interface Bar {
  height: number;
  delay: number;
}

export default function VoiceOverlay({
  isActive,
  type,
  text,
  transcript,
  onClose,
}: VoiceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);

  useEffect(() => {
    if (!isActive || type !== 'stt') {
      setBars([]);
      return;
    }
    const generate = () => {
      setBars(
        Array.from({ length: 24 }, () => ({
          height: Math.random() * 36 + 6,
          delay: Math.random() * 0.5,
        }))
      );
    };
    generate();
    const id = setInterval(generate, 150);
    return () => clearInterval(id);
  }, [isActive, type]);

  useEffect(() => {
    if (!isActive || type !== 'tts') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.offsetWidth || 280;
    const cssH = canvas.offsetHeight || 150;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const colors = VOICE_COLOR_PALETTE[1];
    const [cr, cg, cb] = colors;
    const pulseRings: Array<{ at: number; intensity: number }> = [];
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

      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
      glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.13)`);
      glow.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, 0.04)`);
      glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
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
        const alpha = (1 - age) * 0.35;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.lineWidth = 1 + (1 - age) * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.03 + age * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(cx, cy);
      const rot = t * 0.25;

      ctx.lineWidth = 0.8;
      [-0.55, 0, 0.55].forEach((lat) => {
        const ly = Math.sin(lat) * r * 0.72;
        const lxr = Math.cos(lat) * r;
        ctx.strokeStyle = `rgba(173, 186, 199, ${0.1 + idlePulse * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(0, ly, lxr, r * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let i = 0; i < 5; i++) {
        const phase = rot + (i * Math.PI) / 5;
        const w2 = Math.max(r * 0.12, Math.abs(Math.cos(phase)) * r);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.09 + Math.abs(Math.sin(phase)) * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w2, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const corePulse = 0.5 + Math.sin(t * 2.2) * 0.5;
      const cg2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.28);
      cg2.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.2 + corePulse * 0.07})`);
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

  const borderColor = `rgba(${cr}, ${cg}, ${cb}, 0.35)`;
  const shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.07)`;
  const rgbColor = `rgb(${cr}, ${cg}, ${cb})`;

  return (
    <div
      className={styles.overlay}
      style={{
        border: `1px solid ${borderColor}`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${shadowColor}`,
      }}
    >
      <button onClick={onClose} className={styles.closeBtn}>
        <X size={13} />
      </button>

      {isSpeaking && <canvas ref={canvasRef} className={styles.canvas} />}

      {isListening && (
        <div className={styles.sttBars}>
          {bars.map((bar, i) => (
            <div
              key={i}
              className={styles.bar}
              style={{
                height: `${bar.height}px`,
                background: `linear-gradient(to top, ${rgbColor}, rgba(${cr}, ${cg}, ${cb}, 0.4))`,
                animationDelay: `${bar.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className={styles.statusBar}
        style={{ borderTop: `1px solid rgba(${cr}, ${cg}, ${cb}, 0.15)` }}
      >
        <div className={styles.statusDot} style={{ background: rgbColor }} />
        <span className={styles.statusText} style={{ color: rgbColor }}>
          {isListening ? (
            <>
              <Mic size={13} /> Listening...
            </>
          ) : (
            <>
              <Volume2 size={13} /> Speaking...
            </>
          )}
        </span>
        <button
          onClick={onClose}
          className={styles.stopBtn}
          style={{
            background: `rgba(${cr}, ${cg}, ${cb}, 0.12)`,
            borderColor: `rgba(${cr}, ${cg}, ${cb}, 0.3)`,
            color: rgbColor,
          }}
        >
          Stop
        </button>
      </div>

      {truncated && (
        <div
          className={styles.textPreview}
          style={{ borderTopColor: `rgba(${cr}, ${cg}, ${cb}, 0.08)` }}
        >
          "{truncated}"
        </div>
      )}
    </div>
  );
}
