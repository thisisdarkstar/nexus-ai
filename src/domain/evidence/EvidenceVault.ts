import { storageManager } from '../../core/storage/StorageManager';
import type { StorageEvidence } from '../../core/storage/schema';

export interface EvidenceRecordInput {
  projectId?: string;
  title: string;
  type: 'http_trace' | 'source_snippet' | 'screenshot' | 'log_output' | 'raw_record';
  content: string;
}

export class EvidenceVault {
  private static instance: EvidenceVault;

  private constructor() {}

  public static getInstance(): EvidenceVault {
    if (!EvidenceVault.instance) {
      EvidenceVault.instance = new EvidenceVault();
    }
    return EvidenceVault.instance;
  }

  /**
   * Computes a cryptographic SHA-256 hex hash of any string payload.
   */
  public async computeSha256(content: string): Promise<string> {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // Fallback below
    }

    // Lightweight deterministic fallback hash if Web Crypto is unavailable
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }

  /**
   * Stores a cryptographically hashed evidence record into IndexedDB.
   */
  public async recordEvidence(input: EvidenceRecordInput): Promise<StorageEvidence> {
    const projectId = input.projectId || 'default';
    const sha256Hash = await this.computeSha256(input.content);
    const id = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const evidence: StorageEvidence = {
      id,
      projectId,
      title: input.title,
      type: input.type,
      sha256Hash,
      timestamp: Date.now(),
      content: input.content,
    };

    const db = await storageManager.init();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('evidence', 'readwrite');
      const store = tx.objectStore('evidence');
      const req = store.put(evidence);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return evidence;
  }

  /** Remove all evidence records belonging to an engagement. */
  public async clearEvidence(projectId: string = 'default'): Promise<void> {
    await storageManager.clearEvidence(projectId);
  }

  /**
   * Retrieves all evidence records for a given project.
   */
  public async getEvidence(projectId: string = 'default'): Promise<StorageEvidence[]> {
    const db = await storageManager.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('evidence', 'readonly');
      const store = tx.objectStore('evidence');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export const evidenceVault = EvidenceVault.getInstance();

