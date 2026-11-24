import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import { formatThinkingDuration } from '../../lib/thinkingParser';
import styles from './ThinkingBlock.module.css';

interface ThinkingBlockProps {
  thinking: string;
  isActive?: boolean;
  startedAt?: number;
  duration?: string;
}

export default memo(function ThinkingBlock({
  thinking,
  isActive = false,
  startedAt,
  duration,
}: ThinkingBlockProps) {
  // If actively generating thinking tokens, show expanded. When completed, user can toggle anytime.
  const [isExpanded, setIsExpanded] = useState<boolean>(isActive);
  const [copied, setCopied] = useState(false);

  // If thinking becomes active during a new stream, expand automatically
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive && !wasActive) {
    setIsExpanded(true);
    setWasActive(true);
  }

  const startRef = useRef<number>(startedAt ?? Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0
  );
  const [capturedDuration, setCapturedDuration] = useState<string | undefined>(duration);

  useEffect(() => {
    if (startedAt) {
      startRef.current = startedAt;
    }
  }, [startedAt]);

  useEffect(() => {
    if (duration) {
      setCapturedDuration(duration);
    }
  }, [duration]);

  useEffect(() => {
    if (!isActive) {
      setCapturedDuration((prev) => prev ?? ((Date.now() - startRef.current) / 1000).toFixed(1));
      return;
    }

    if (!startedAt) {
      startRef.current = Date.now();
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, (Date.now() - startRef.current) / 1000));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 100);
    return () => clearInterval(timer);
  }, [isActive, startedAt]);

  const wordCount = useMemo(() => {
    return thinking.trim().split(/\s+/).filter(Boolean).length;
  }, [thinking]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(thinking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedHtml = useMemo(() => {
    return renderMarkdown(thinking);
  }, [thinking]);

  const finalDuration = duration ?? (wasActive ? capturedDuration : undefined);

  return (
    <div className={`${styles.thinkingBlock} ${isActive ? styles.thinkingActive : ''}`}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerToggleBtn}
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          title={isExpanded ? 'Click to hide thinking process' : 'Click to show thinking process'}
        >
          <div className={styles.headerLeft}>
            <Sparkles
              size={13}
              className={`${styles.icon} ${isActive ? styles.iconSpin : ''}`}
            />
            <span className={styles.title}>
              {isActive
                ? 'Thinking...'
                : finalDuration
                  ? `Thought for ${formatThinkingDuration(finalDuration)}`
                  : 'Thought Process'}
            </span>
            {isActive && (
              <span className={styles.timerBadge} aria-label="Thinking elapsed time">
                {formatThinkingDuration(elapsedSeconds)}
              </span>
            )}
            {wordCount > 0 && !isActive && (
              <span className={styles.badge}>{wordCount} words</span>
            )}
          </div>

          <div className={styles.toggleAction}>
            <span>{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? (
              <ChevronDown size={13} className={styles.chevron} />
            ) : (
              <ChevronRight size={13} className={styles.chevron} />
            )}
          </div>
        </button>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            title="Copy thought process"
            aria-label="Copy thought process"
          >
            {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      )}
    </div>
  );
});
