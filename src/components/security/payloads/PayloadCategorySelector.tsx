import React from 'react';
import {
  Terminal,
  Radio,
  Database,
  Flame,
  FolderOpen,
  Globe,
  Code,
  ShieldAlert,
  FileCode,
  Layers,
} from 'lucide-react';
import CustomSelect from '../../CustomSelect';
import {
  PAYLOAD_CATEGORIES,
  type PayloadCategory,
} from '../../../data/security/payloadCatalog';
import styles from '../PayloadCrafter.module.css';

interface PayloadCategorySelectorProps {
  activeCategory: PayloadCategory;
  onSelectCategory: (cat: PayloadCategory) => void;
}

const ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Terminal,
  Radio,
  Database,
  Flame,
  FolderOpen,
  Globe,
  Code,
  ShieldAlert,
  FileCode,
};

export default function PayloadCategorySelector({
  activeCategory,
  onSelectCategory,
}: PayloadCategorySelectorProps) {
  const currentCategory =
    PAYLOAD_CATEGORIES.find((c) => c.id === activeCategory) || PAYLOAD_CATEGORIES[0];

  const options = PAYLOAD_CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: ICON_COMPONENTS[cat.iconName] || Code,
    badge: cat.badge,
    badgeColor: '#10b981',
  }));

  return (
    <div className={styles.categoryDropdownBar}>
      <div className={styles.categorySelectGroup}>
        <span className={styles.categoryLabel}>
          <Layers size={14} color="var(--accent-color)" /> Category:
        </span>
        <CustomSelect
          value={activeCategory}
          options={options}
          onChange={(val) => onSelectCategory(val as PayloadCategory)}
          style={{ minWidth: '240px' }}
        />
      </div>

      <div className={styles.categoryInfoPill}>
        <span>{currentCategory.desc}</span>
      </div>
    </div>
  );
}
