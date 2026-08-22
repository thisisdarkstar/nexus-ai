import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import styles from './CustomSelect.module.css';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'method';
  title?: string;
  style?: React.CSSProperties;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  size = 'md',
  variant = 'default',
  title,
  style,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon;

  const sizeClass = size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : '';
  const methodClass = variant === 'method' && value ? styles[`method_${value}`] : '';

  return (
    <div
      ref={containerRef}
      className={`${styles.selectWrapper} ${sizeClass} ${className}`}
      style={style}
      title={title}
    >
      <button
        type="button"
        disabled={disabled}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${methodClass}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className={styles.triggerContent}>
          {SelectedIcon && (
            <span className={styles.triggerIcon}>
              <SelectedIcon size={size === 'sm' ? 12 : 14} />
            </span>
          )}
          <span className={styles.triggerLabel}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={size === 'sm' ? 12 : 13}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu} role="listbox">
          {options.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={`${styles.optionItem} ${isSelected ? styles.optionItemActive : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <div className={styles.optionLeft}>
                  {OptionIcon && (
                    <span className={styles.optionIcon}>
                      <OptionIcon size={13} color={isSelected ? '#10b981' : undefined} />
                    </span>
                  )}
                  <span className={styles.optionText}>{option.label}</span>
                </div>

                {option.badge && (
                  <span
                    className={styles.optionBadge}
                    style={{
                      background: option.badgeColor ? `${option.badgeColor}20` : 'rgba(255,255,255,0.1)',
                      color: option.badgeColor || '#94a3b8',
                      border: `1px solid ${option.badgeColor ? `${option.badgeColor}40` : 'rgba(255,255,255,0.15)'}`,
                    }}
                  >
                    {option.badge}
                  </span>
                )}

                {isSelected && <Check size={12} className={styles.optionCheck} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
