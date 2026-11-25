import { chunkDocument, estimateTokens, type DocumentChunk } from './documentChunker';
import { simpleVectorSearch, type SearchResult } from './simpleVectorSearch';
import { projectLocalStorage } from '../../core/storage/projectStorage';

export interface VaultDocument {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  content: string;
  chunks: DocumentChunk[];
  enabled: boolean;
  tokenCount: number;
  scope?: 'project' | 'global';
}

const VAULT_STORAGE_KEY = 'nexus_copilot_vault_docs_v1';
const VAULT_GLOBAL_KEY = 'nexus_copilot_vault_global_v1';

class VaultStore {
  private static instance: VaultStore;
  private documents: VaultDocument[] = [];
  private listeners: Set<(docs: VaultDocument[]) => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): VaultStore {
    if (!VaultStore.instance) {
      VaultStore.instance = new VaultStore();
    }
    return VaultStore.instance;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    const loaded: VaultDocument[] = [];
    try {
      const rawProject = projectLocalStorage.getItem(VAULT_STORAGE_KEY);
      if (rawProject) {
        const parsed = JSON.parse(rawProject) as VaultDocument[];
        if (Array.isArray(parsed)) {
          loaded.push(...parsed.map((d) => ({ ...d, scope: 'project' as const })));
        }
      }
    } catch (err) {
      console.warn('[VaultStore] Failed to parse project vault docs:', err);
    }
    try {
      const rawGlobal = localStorage.getItem(VAULT_GLOBAL_KEY);
      if (rawGlobal) {
        const parsed = JSON.parse(rawGlobal) as VaultDocument[];
        if (Array.isArray(parsed)) {
          loaded.push(...parsed.map((d) => ({ ...d, scope: 'global' as const })));
        }
      }
    } catch (err) {
      console.warn('[VaultStore] Failed to parse global vault docs:', err);
    }
    this.documents = loaded;
  }

  public reloadForProject(): void {
    this.loadFromStorage();
    this.notify();
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    const projectDocs = this.documents.filter((d) => (d.scope || 'project') === 'project');
    const globalDocs = this.documents.filter((d) => d.scope === 'global');
    try {
      projectLocalStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(projectDocs));
      localStorage.setItem(VAULT_GLOBAL_KEY, JSON.stringify(globalDocs));
    } catch (err) {
      console.error('[VaultStore] Failed to save vault docs to storage:', err);
    }
    this.notify();
  }

  private notify(): void {
    const copy = [...this.documents];
    this.listeners.forEach((fn) => fn(copy));
  }

  public subscribe(listener: (docs: VaultDocument[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.documents]);
    return () => this.listeners.delete(listener);
  }

  public getDocuments(): VaultDocument[] {
    return [...this.documents];
  }

  public getActiveChunks(): DocumentChunk[] {
    const activeDocs = this.documents.filter((d) => d.enabled);
    return activeDocs.flatMap((d) => d.chunks);
  }

  public getTotalTokenCount(): number {
    return this.documents.reduce((sum, d) => sum + d.tokenCount, 0);
  }

  public getActiveTokenCount(): number {
    return this.documents
      .filter((d) => d.enabled)
      .reduce((sum, d) => sum + d.tokenCount, 0);
  }

  public async addDocument(
    name: string,
    content: string,
    scope: 'project' | 'global' = 'project'
  ): Promise<VaultDocument> {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const chunks = chunkDocument(id, name, content);
    const tokenCount = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    const newDoc: VaultDocument = {
      id,
      name,
      size: new Blob([content]).size,
      uploadedAt: Date.now(),
      content,
      chunks,
      enabled: true,
      tokenCount,
      scope,
    };

    this.documents.push(newDoc);
    this.saveToStorage();
    return newDoc;
  }

  public removeDocument(id: string): void {
    this.documents = this.documents.filter((d) => d.id !== id);
    this.saveToStorage();
  }

  public toggleDocument(id: string, enabled?: boolean): void {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;
    doc.enabled = enabled !== undefined ? enabled : !doc.enabled;
    this.saveToStorage();
  }

  public toggleDocumentScope(id: string): void {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;
    doc.scope = doc.scope === 'global' ? 'project' : 'global';
    this.saveToStorage();
  }

  public clearAll(): void {
    this.documents = [];
    this.saveToStorage();
  }

  /**
   * Search active vault documents using BM25 relevance ranking.
   */
  public search(query: string, topK: number = 4): SearchResult[] {
    const activeChunks = this.getActiveChunks();
    return simpleVectorSearch.search(query, activeChunks, topK);
  }
}

export const vaultStore = VaultStore.getInstance();
