import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ChevronUp, Check, RotateCw } from 'lucide-react';
import type { Settings, AvailableModel } from '../../types';
import styles from './ModelMenu.module.css';

const MENU_WIDTH = 280;
const GAP = 10;
const MARGIN = 8;

interface ModelMenuProps {
  settings: Settings;
  availableModels: AvailableModel[];
  isGenerating: boolean;
  onModelChange: (provider: string, model: string) => void;
}

interface MenuPosition {
  left: number;
  top?: number;
  bottom?: number;
}

export default function ModelMenu({
  settings,
  availableModels,
  isGenerating,
  onModelChange,
}: ModelMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition>({ left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  // Compute placement: open toward whichever side of the viewport has more room,
  // then clamp horizontally so the menu never exits the viewport.
  const computePosition = useCallback((): MenuPosition | null => {
    const trigger = wrapperRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceAbove > spaceBelow;

    const rightAligned = rect.right - MENU_WIDTH;
    const left = Math.max(
      MARGIN,
      Math.min(rightAligned, window.innerWidth - MENU_WIDTH - MARGIN)
    );

    return openUpward
      ? { left, bottom: window.innerHeight - rect.top + GAP }
      : { left, top: rect.bottom + GAP };
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      close();
      return;
    }
    const pos = computePosition();
    if (!pos) return;
    setMenuPos(pos);
    setIsOpen(true);
  };

  // Reposition while open so scroll / resize / panel drag can't strand the menu off-screen
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const pos = computePosition();
      if (pos) setMenuPos(pos);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, computePosition]);

  // Close on any click outside the trigger or menu (menu is portaled to <body>)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current?.contains(target) ||
        (target instanceof Element && target.closest(`.${styles.menu}`))
      ) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  const currentLabel =
    settings.provider === 'openai' ? settings.openaiModel || 'Select Model' : 'Gemini Nano';

  const menuContent = isOpen ? (
    <>
      <div className={styles.overlay} onClick={close} />
      <div
        className={styles.menu}
        role="menu"
        aria-label="Switch Model"
        style={{
          position: 'fixed',
          left: menuPos.left,
          ...(menuPos.top !== undefined ? { top: menuPos.top } : { bottom: menuPos.bottom }),
        }}
      >
        <div className={styles.menuHeader}>
          <span>Switch Model</span>
          <Sparkles size={12} />
        </div>

        <button
          onClick={() => {
            onModelChange('chrome', 'Gemini Nano');
            close();
          }}
          className={`${styles.option} ${settings.provider === 'chrome' ? styles.optionActive : ''}`}
        >
          <Sparkles size={14} color="var(--accent-color)" />
          <span>Gemini Nano (Built-in)</span>
          {settings.provider === 'chrome' && <Check size={14} className={styles.check} />}
        </button>

        {availableModels.length > 0 && <div className={styles.divider} />}

        {availableModels.map((m) => {
          const active = settings.provider === 'openai' && settings.openaiModel === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                onModelChange('openai', m.id);
                close();
              }}
              className={`${styles.option} ${active ? styles.optionActive : ''}`}
            >
              <RotateCw size={14} />
              <span className={styles.optionLabel}>{m.id}</span>
              {active && <Check size={14} className={styles.check} />}
            </button>
          );
        })}
      </div>
    </>
  ) : null;

  return (
    <div className={styles.container} ref={wrapperRef}>
      <button
        onClick={handleToggle}
        disabled={isGenerating}
        className={`${styles.trigger} ${isGenerating ? styles.triggerDisabled : ''}`}
        title={`Selected Model: ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Sparkles size={14} style={{ flexShrink: 0 }} />
        <span className={styles.triggerLabel}>{currentLabel}</span>
        <ChevronUp size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} style={{ flexShrink: 0 }} />
      </button>

      {createPortal(menuContent, document.body)}
    </div>
  );
}
