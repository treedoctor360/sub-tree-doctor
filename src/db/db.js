// 端末内保存（IndexedDB）。相談記録を永続化。wood-decay-fungi と同じ薄いラッパー方式。

const IDB_NAME = 'sub-tree-doctor-db';
const IDB_VER = 2; // v2: sites（現地）ストアを追加。既存 records は保持（消さない）。
const STORE = 'records';
const SITE_STORE = 'sites';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // ★既存 records の作成分岐は必ず残す（v1→v2で既存カルテを消さないため）。
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SITE_STORE)) db.createObjectStore(SITE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(rec) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbRemove(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- 現地（sites）ストア ---
export async function idbGetAllSites() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(SITE_STORE, 'readonly').objectStore(SITE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutSite(site) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SITE_STORE, 'readwrite');
    tx.objectStore(SITE_STORE).put(site);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbRemoveSite(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SITE_STORE, 'readwrite');
    tx.objectStore(SITE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
