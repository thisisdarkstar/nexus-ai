import { parseSecurityArtifact } from '../../lib/security/artifactParsers';

self.onmessage = (e: MessageEvent) => {
  const { id, content, fileName } = e.data || {};

  try {
    const result = parseSecurityArtifact(content, fileName);
    self.postMessage({
      id,
      type: 'COMPLETE',
      result,
    });
  } catch (err: any) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: err?.message || 'Failed to parse security artifact in worker',
    });
  }
};
