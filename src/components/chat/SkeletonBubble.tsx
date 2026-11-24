import styles from './SkeletonBubble.module.css';

interface SkeletonBubbleProps {
  isUser?: boolean;
  width?: string;
}

export default function SkeletonBubble({ isUser, width }: SkeletonBubbleProps) {
  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : styles.wrapperAi}`}>
      <div
        className={`${styles.skeleton} ${!isUser ? styles.skeletonAi : ''}`}
        style={width ? { width } : undefined}
      >
        <div className={styles.shimmer} />
      </div>
    </div>
  );
}
