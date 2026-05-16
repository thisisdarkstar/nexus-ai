export default function SkeletonBubble({ isUser, width }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
      <div style={{ height: '64px', width, borderRadius: isUser ? '20px 20px 4px 20px' : '4px 20px 20px 20px', background: 'var(--card-glass)', border: '1px solid var(--card-border)', position: 'relative', overflow: 'hidden' }}>
        <div className="skeleton-shimmer" />
      </div>
    </div>
  );
}
