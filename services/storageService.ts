
import { Dataset, UserUsage, Subscription } from '../types';

const DB_NAME = 'ToeasyAI_DB';
const DB_VERSION = 1;
const STORE_DATASET = 'active_dataset';
const STORE_META = 'app_metadata';

export class StorageService {
  private static async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_DATASET)) {
          db.createObjectStore(STORE_DATASET);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
    });
  }

  static async saveDataset(dataset: Dataset | null): Promise<void> {
    if (!dataset) return;
    // Strip history stack from persistence if it gets too large to save space
    // We only keep the last state for restoration
    const { historyStack, ...datasetToSave } = dataset; 
    
    const db = await this.openDB();
    const tx = db.transaction(STORE_DATASET, 'readwrite');
    tx.objectStore(STORE_DATASET).put(datasetToSave, 'current');
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }

  static async loadDataset(): Promise<Dataset | null> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_DATASET, 'readonly');
    const request = tx.objectStore(STORE_DATASET).get('current');
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result as Dataset || null);
      request.onerror = () => resolve(null);
    });
  }

  static async saveMetadata(usage: UserUsage, subscription: Subscription): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ usage, subscription }, 'meta');
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }

  static async loadMetadata(): Promise<{ usage: UserUsage, subscription: Subscription } | null> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_META, 'readonly');
    const request = tx.objectStore(STORE_META).get('meta');
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
    });
  }
}
