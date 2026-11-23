import React, { useState, useMemo, memo } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import styles from './ThinkingBlock.module.css';

interface ThinkingBlockProps {
  thinking: string;
  isActive?: boolean;
}

export default memo(function ThinkingBlock({ thinking, isActive = false }: ThinkingBlockProps) {
  // If actively generating thinking tokens, show expanded. When completed, user can toggle anytime.
  const [isExpanded, setIsExpanded] = useState<boolean>(isActive);
  const [copied, setCopied] = useState(false);

  // If thinking becomes active during a new stream, expand automatically
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive && !wasActive) {
    setIsExpanded(true);
    setWasActive(true);
  }

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

  return (
    <div className={`${styles.thinkingBlock} ${isActive ? styles.thinkingActive : ''}`}>
      <button
        type="button"
        className={styles.header}
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
            {isActive ? 'Thinking...' : 'Thought Process'}
          </span>
          {wordCount > 0 && !isActive && (
            <span className={styles.badge}>{wordCount} words</span>
          )}
        </div>

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
          <div className={styles.toggleAction}>
            <span>{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? (
              <ChevronDown size={13} className={styles.chevron} />
            ) : (
              <ChevronRight size={13} className={styles.chevron} />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      )}
    </div>
  );
});
