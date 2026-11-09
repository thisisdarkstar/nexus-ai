import { storageManager } from '../core/storage/StorageManager';
import { eventBus } from '../core/bus/EventBus';
import { parseSecurityArtifact, type ParsedArtifactResult } from '../lib/security/artifactParsers';
import type { ReconAsset, ScopeItem, VulnerabilityFinding } from '../types';

export interface IngestionOptions {
  projectId?: string;
  onProgress?: (progress: { percent: number; message: string }) => void;
}

export class IngestionService {
  private static instance: IngestionService;
  private worker: Worker | null = null;
  private pendingRequests: Map<
    string,
    {
      resolve: (res: ParsedArtifactResult) => void;
      reject: (err: Error) => void;
    }
  > = new Map();

  private constructor() {
    this.initWorker();
  }

  public static getInstance(): IngestionService {
    if (!IngestionService.instance) {
      IngestionService.instance = new IngestionService();
    }
    return IngestionService.instance;
  }

  private initWorker(): void {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        this.worker = new Worker(
          new URL('../core/workers/ingestion.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent) => {
          const { id, type, result, error } = e.data || {};
          const pending = this.pendingRequests.get(id);
          if (!pending) return;

          this.pendingRequests.delete(id);
          if (type === 'COMPLETE' && result) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || 'Worker parsing error'));
          }
        };

        this.worker.onerror = (e) => {
          console.error('[IngestionService] Worker error:', e);
        };
      }
    } catch (e) {
      console.warn('[IngestionService] Web Worker unavailable, using main thread fallback:', e);
      this.worker = null;
    }
  }

  /**
   * Ingests a raw file content off the main thread.
   * Automatically persists parsed assets, findings, and scope into IndexedDB
   * and notifies the application via the typed EventBus.
   */
  public async ingestFile(
    content: string,
    fileName: string,
    options: IngestionOptions = {}
  ): Promise<ParsedArtifactResult> {
    const projectId = options.projectId || 'default';
    const reqId = `ingest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    options.onProgress?.({ percent: 15, message: `Parsing ${fileName}...` });

    let result: ParsedArtifactResult;

    // Use Worker if available, else synchronous fallback
    if (this.worker) {
      result = await new Promise<ParsedArtifactResult>((resolve, reject) => {
        this.pendingRequests.set(reqId, { resolve, reject });
        this.worker!.postMessage({ id: reqId, content, fileName });
      });
    } else {
      result = parseSecurityArtifact(content, fileName);
    }

    options.onProgress?.({ percent: 65, message: 'Saving parsed entities to IndexedDB...' });

    // 1. Persist Recon Assets to IndexedDB
    if (result.reconAssets && result.reconAssets.length > 0) {
      const storageAssets = result.reconAssets.map((a) => ({
        ...a,
        projectId,
        createdAt: a.createdAt || Date.now(),
      }));
      await storageManager.saveAssets(storageAssets);
      eventBus.publish('recon:assets-added', { assets: result.reconAssets, projectId });
    }

    // 2. Persist Scope Items to IndexedDB
    if (result.scopeItems && result.scopeItems.length > 0) {
      await storageManager.saveScope(result.scopeItems, projectId);
      eventBus.publish('scope:added', { items: result.scopeItems, projectId });
    }

    // 3. Persist Findings to IndexedDB
    if (result.findings && result.findings.length > 0) {
      for (const f of result.findings) {
        await storageManager.saveFinding({
          id: f.id,
          projectId,
          title: f.title,
          severity: f.severity,
          cweId: f.cweId,
          owaspCategory: f.owaspCategory,
          targetEndpoint: f.targetEndpoint,
          description: f.description,
          remediation: f.remediation,
          status: 'open',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        eventBus.publish('finding:added', { finding: f, projectId });
      }
    }

    options.onProgress?.({ percent: 100, message: 'Ingestion complete' });
    return result;
  }
}

export const ingestionService = IngestionService.getInstance();
