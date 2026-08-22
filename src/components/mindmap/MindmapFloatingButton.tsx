import { Network } from 'lucide-react';
import styles from './MindmapFloatingButton.module.css';

interface MindmapFloatingButtonProps {
  onClick: () => void;
  nodeCount?: number;
  isOpen?: boolean;
}

export default function MindmapFloatingButton({
  onClick,
  nodeCount = 0,
  isOpen = false,
}: MindmapFloatingButtonProps) {
  if (isOpen) return null;

  return (
    <div className={styles.floatingContainer}>
      <button
        className={styles.floatingBtn}
        onClick={onClick}
        title="Open Mindmap & Spatial Canvas Studio (Alt+M)"
        aria-label="Open Mindmap Studio"
      >
        <div className={styles.pulseGlow} />
        <Network size={22} />
        {nodeCount > 0 && <span className={styles.badge}>{nodeCount > 99 ? '99+' : nodeCount}</span>}
      </button>
    </div>
  );
}
