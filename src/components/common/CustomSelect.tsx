import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Trash2 } from 'lucide-react';
import styles from './CustomSelect.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
  onAction?: (value: T) => void;
  actionIcon?: React.ReactNode;
  actionTitle?: string;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: (SelectOption<T> | { value: T; label: string })[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'right';
  id?: string;
  ariaLabel?: string;
}

export default function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  style,
  align = 'left',
  id,
  ariaLabel,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 4;
    const margin = 8;

    const spaceBelow = viewportH - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const shouldOpenUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;
    setOpenUpwards(shouldOpenUpwards);

    const availableVertical = shouldOpenUpwards ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(380, Math.max(120, Math.floor(availableVertical - gap)));
    const minWidth = Math.max(rect.width, 140);
    const maxWidth = Math.min(380, viewportW - margin * 2);
    const measuredWidth = menuRef.current ? menuRef.current.getBoundingClientRect().width : minWidth;
    const effectiveWidth = Math.min(Math.max(minWidth, measuredWidth), maxWidth);

    const verticalPos: React.CSSProperties = shouldOpenUpwards
      ? { top: 'auto', bottom: Math.max(margin, viewportH - rect.top + gap), maxHeight }
      : { top: Math.min(rect.bottom + gap, viewportH - margin - 40), bottom: 'auto', maxHeight };

    const horizontalPos: React.CSSProperties =
      align === 'right'
        ? { left: 'auto', right: Math.max(margin, viewportW - rect.right), minWidth, maxWidth }
        : {
            left: Math.min(Math.max(margin, rect.left), Math.max(margin, viewportW - effectiveWidth - margin)),
            right: 'auto',
            minWidth,
            maxWidth,
          };

    setMenuStyle({
      ...verticalPos,
      ...horizontalPos,
    });
  }, [align]);

  // Close on click outside (must check both trigger wrapper and portaled menu)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Synchronously position portaled menu before paint & keep aligned on scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, options.length, updateMenuPosition]);

  // Keep focused option visible in scroll container
  useEffect(() => {
    if (isOpen && menuRef.current && focusedIndex >= 0) {
      const items = menuRef.current.querySelectorAll('[role="option"]');
      const target = items[focusedIndex] as HTMLElement | undefined;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex((opt) => opt.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        const chosen = options[focusedIndex];
        onChange(chosen.value);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleSelect = (optionVal: T) => {
    onChange(optionVal);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.selectWrapper} ${isOpen ? styles.selectWrapperOpen : ''} ${className}`}
      style={style}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            const idx = options.findIndex((opt) => opt.value === value);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${
          disabled ? styles.triggerDisabled : ''
        } ${triggerClassName}`}
      >
        <div className={styles.triggerContent}>
          {'icon' in (selectedOption || {}) && (selectedOption as SelectOption<T>).icon}
          <span className={styles.triggerLabel}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {'badge' in (selectedOption || {}) && (selectedOption as SelectOption<T>).badge && (
            <span className={styles.badge}>{(selectedOption as SelectOption<T>).badge}</span>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            tabIndex={-1}
            style={menuStyle}
            onKeyDown={handleKeyDown}
            className={`${styles.dropdownMenu} ${
              openUpwards ? styles.dropdownMenuUpwards : ''
            } ${menuClassName}`}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focusedIndex;
              const hasIcon = 'icon' in opt && opt.icon;
              const hasBadge = 'badge' in opt && opt.badge;
              const hasAction = 'onAction' in opt && typeof (opt as SelectOption<T>).onAction === 'function';
              const actionIcon = 'actionIcon' in opt ? (opt as SelectOption<T>).actionIcon : undefined;
              const actionTitle = 'actionTitle' in opt ? (opt as SelectOption<T>).actionTitle : undefined;

              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  className={`${styles.optionItem} ${isSelected ? styles.optionItemActive : ''} ${
                    isFocused && !isSelected ? styles.optionItemFocused : ''
                  }`}
                >
                  <div className={styles.optionLeft}>
                    {hasIcon && (opt as SelectOption<T>).icon}
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {hasBadge && <span className={styles.badge}>{(opt as SelectOption<T>).badge}</span>}
                  </div>
                  <div className={styles.optionRight}>
                    {hasAction && (
                      <button
                        type="button"
                        className={styles.optionActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          (opt as SelectOption<T>).onAction!(opt.value);
                        }}
                        title={actionTitle || 'Delete'}
                        aria-label={actionTitle || 'Delete'}
                      >
                        {actionIcon || <Trash2 size={12} />}
                      </button>
                    )}
                    {isSelected && <Check size={12} className={styles.checkIcon} />}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
