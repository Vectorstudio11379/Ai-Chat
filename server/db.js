import fs from 'fs';
import path from 'path';

export class ChatStore {
  constructor(storagePath = ':memory:') {
    this.storagePath = storagePath;
    this.chats = new Map(); // key: `${passphraseHash}:${id}`, value: chatSession
    
    if (this.storagePath !== ':memory:') {
      this.initFileStorage();
    }
  }

  initFileStorage() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const list = JSON.parse(raw);
        for (const item of list) {
          this.chats.set(`${item.passphraseHash}:${item.id}`, item);
        }
      }
    } catch (err) {
      console.error('Failed to initialize file storage:', err);
    }
  }

  persist() {
    if (this.storagePath === ':memory:') return;
    try {
      const array = Array.from(this.chats.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(array, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  upsert(passphraseHash, chat) {
    const key = `${passphraseHash}:${chat.id}`;
    const entry = {
      ...chat,
      passphraseHash,
      updatedAt: chat.updatedAt || Date.now(),
    };
    this.chats.set(key, entry);
    this.persist();
    return entry;
  }

  list(passphraseHash) {
    const result = [];
    for (const [key, value] of this.chats.entries()) {
      if (key.startsWith(`${passphraseHash}:`)) {
        // Strip internal passphraseHash from returned data
        const { passphraseHash: _, ...chatData } = value;
        result.push(chatData);
      }
    }
    // Sort latest updated first
    return result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  get(passphraseHash, id) {
    const key = `${passphraseHash}:${id}`;
    const entry = this.chats.get(key);
    if (!entry) return null;
    const { passphraseHash: _, ...chatData } = entry;
    return chatData;
  }

  delete(passphraseHash, id) {
    const key = `${passphraseHash}:${id}`;
    const existed = this.chats.delete(key);
    if (existed) {
      this.persist();
    }
    return existed;
  }

  clear() {
    this.chats.clear();
    this.persist();
  }
}

export function createStore(storagePath = ':memory:') {
  return new ChatStore(storagePath);
}
