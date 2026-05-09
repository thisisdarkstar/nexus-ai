export class StorageDB {
    constructor() {
        this.dbName = 'nexus_ai_react_db';
        this.dbVersion = 2;
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
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
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
        return JSON.stringify(chats, null, 2);
    }

    async importData(jsonData) {
        try {
            const chats = JSON.parse(jsonData);
            if (!Array.isArray(chats)) throw new Error("Invalid format");
            
            for (const chat of chats) {
                if (chat.id && chat.messages) {
                    await this.saveChat(chat);
                }
            }
        } catch (e) {
            throw new Error("Failed to import data: " + e.message, { cause: e });
        }
    }
}
export const db = new StorageDB();
