import { DB_NAME, DB_VERSION, type StorageAsset, type StorageFinding, type StorageEvidence } from './schema';
import type { ScopeItem, SecurityChecklistItem } from '../../types';

export class StorageManager {
  private static instance: StorageManager;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private constructor() {}

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // Assets Store (Partitioned by projectId)
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('projectId', 'projectId', { unique: false });
          assetStore.createIndex('riskScore', 'riskScore', { unique: false });
          assetStore.createIndex('host', 'host', { unique: false });
        }

        // Findings Store (Partitioned by projectId)
        if (!db.objectStoreNames.contains('findings')) {
          const findingStore = db.createObjectStore('findings', { keyPath: 'id' });
          findingStore.createIndex('projectId', 'projectId', { unique: false });
          findingStore.createIndex('severity', 'severity', { unique: false });
        }

        // Target Scope Rules
        if (!db.objectStoreNames.contains('scope')) {
          const scopeStore = db.createObjectStore('scope', { keyPath: 'id' });
          scopeStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Checklists
        if (!db.objectStoreNames.contains('checklists')) {
          const clStore = db.createObjectStore('checklists', { keyPath: 'id' });
          clStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Evidence Vault
        if (!db.objectStoreNames.contains('evidence')) {
          const evStore = db.createObjectStore('evidence', { keyPath: 'id' });
          evStore.createIndex('projectId', 'projectId', { unique: false });
          evStore.createIndex('sha256Hash', 'sha256Hash', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // Assets Operations
  public async getAssets(projectId: string = 'default'): Promise<StorageAsset[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async saveAssets(assets: StorageAsset[]): Promise<void> {
    if (assets.length === 0) return;
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      assets.forEach((a) => store.put(a));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async clearAssets(projectId: string = 'default'): Promise<void> {
    const db = await this.init();
    const assets = await this.getAssets(projectId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      assets.forEach((a) => store.delete(a.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Findings Operations
  public async getFindings(projectId: string = 'default'): Promise<StorageFinding[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('findings', 'readonly');
      const store = tx.objectStore('findings');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async saveFinding(finding: StorageFinding): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('findings', 'readwrite');
      const store = tx.objectStore('findings');
      const req = store.put(finding);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteFinding(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('findings', 'readwrite');
      const store = tx.objectStore('findings');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Scope Operations
  public async getScope(projectId: string = 'default'): Promise<ScopeItem[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scope', 'readonly');
      const store = tx.objectStore('scope');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async saveScope(items: Array<ScopeItem & { projectId?: string }>, projectId: string = 'default'): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scope', 'readwrite');
      const store = tx.objectStore('scope');
      items.forEach((item) => {
        store.put({
          ...item,
          projectId: item.projectId || projectId,
        });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const storageManager = StorageManager.getInstance();
