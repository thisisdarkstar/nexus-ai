export class StorageDB {
    constructor() {
        this.dbName = 'nexus_ai_react_db';
        this.dbVersion = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let chatsStore;
                if (!db.objectStoreNames.contains('chats')) {
                    chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
                } else {
                    chatsStore = e.target.transaction.objectStore('chats');
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

    async saveChat(chat) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');
            const req = store.put(chat);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getChats() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('chats', 'readonly');
            const store = tx.objectStore('chats');
            const req = store.getAll();
            req.onsuccess = () => {
                const chats = req.result;
                chats.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(chats);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async saveProject(project) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const req = store.put(project);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getProjects() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.getAll();
            req.onsuccess = () => {
                const projects = req.result;
                projects.sort((a, b) => b.createdAt - a.createdAt);
                resolve(projects);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async deleteProject(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async deleteChat(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    
    async clearAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async exportAll() {
        const chats = await this.getChats();
        const projects = await this.getProjects();
        return JSON.stringify({ chats, projects }, null, 2);
    }

    async importData(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            // Support both old format (plain array) and new format ({ chats, projects })
            const chats = Array.isArray(parsed) ? parsed : (parsed.chats || []);
            const projects = Array.isArray(parsed) ? [] : (parsed.projects || []);

            if (!Array.isArray(chats)) throw new Error("Invalid format");

            for (const chat of chats) {
                if (chat.id && chat.messages) {
                    await this.saveChat(chat);
                }
            }
            for (const project of projects) {
                if (project.id && project.name) {
                    await this.saveProject(project);
                }
            }
        } catch (e) {
            throw new Error("Failed to import data: " + e.message, { cause: e });
        }
    }
}
export const db = new StorageDB();
