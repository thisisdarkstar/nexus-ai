import type { Chat, Project } from '../types';

export class StorageDB {
  dbName: string;
  dbVersion: number;
  db: IDBDatabase | null;

  constructor() {
    this.dbName = 'nexus_ai_react_db';
    this.dbVersion = 3;
    this.db = null;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        let chatsStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('chats')) {
          chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
        } else {
          chatsStore = (e.target as IDBOpenDBRequest).transaction!.objectStore('chats');
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (e.oldVersion < 3) {
          if (!chatsStore.indexNames.contains('projectId')) {
            chatsStore.createIndex('projectId', 'projectId', { unique: false });
          }
          if (!chatsStore.indexNames.contains('updatedAt')) {
            chatsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        }
      };
    });
  }

  private assertDb(): IDBDatabase {
    if (!this.db) throw new Error('Database not initialized. Call init() first.');
    return this.db;
  }

  async saveChat(chat: Chat): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const req = store.put(chat);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getChats(): Promise<Chat[]> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const req = store.getAll();
      req.onsuccess = () => {
        const chats = req.result as Chat[];
        chats.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(chats);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveProject(project: Project): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getProjects(): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => {
        const projects = req.result as Project[];
        projects.sort((a, b) => b.createdAt - a.createdAt);
        resolve(projects);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteChat(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.assertDb().transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updateChatTags(chatId: string, tags: string[]): Promise<void> {
    const chats = await this.getChats();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      chat.tags = tags;
      await this.saveChat(chat);
    }
  }

  async exportAll(): Promise<string> {
    const chats = await this.getChats();
    const projects = await this.getProjects();
    const safeChats = chats.map(({ systemPrompt, ...rest }) => rest);
    return JSON.stringify({ chats: safeChats, projects }, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const parsed = JSON.parse(jsonData);
      const chats: Chat[] = Array.isArray(parsed) ? parsed : parsed.chats || [];
      const projects: Project[] = Array.isArray(parsed) ? [] : parsed.projects || [];

      if (!Array.isArray(chats)) throw new Error('Invalid format');

      for (const chat of chats) {
        if (
          chat.id &&
          typeof chat.id === 'string' &&
          chat.messages &&
          Array.isArray(chat.messages) &&
          typeof chat.title === 'string'
        ) {
          const sanitized: Chat = {
            id: chat.id,
            workspaceId: typeof chat.workspaceId === 'string' ? chat.workspaceId : 'default',
            title: chat.title.replace(/<[^>]*>/g, '').slice(0, 200),
            messages: chat.messages
              .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'ai'))
              .map((m) => ({
                ...m,
                content: m.content.slice(0, 100000),
              })),
            createdAt: typeof chat.createdAt === 'number' ? chat.createdAt : Date.now(),
            updatedAt: typeof chat.updatedAt === 'number' ? chat.updatedAt : Date.now(),
          };
          await this.saveChat(sanitized);
        }
      }
      for (const project of projects) {
        if (project.id && typeof project.id === 'string' && project.name && typeof project.name === 'string') {
          const sanitized: Project = {
            id: project.id,
            name: project.name.replace(/<[^>]*>/g, '').slice(0, 100),
            createdAt: typeof project.createdAt === 'number' ? project.createdAt : Date.now(),
          };
          await this.saveProject(sanitized);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const err = new Error('Failed to import data: ' + msg);
      err.cause = e;
      throw err;
    }
  }
}

export const db = new StorageDB();
