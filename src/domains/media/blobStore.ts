/**
 * Demo blob store — the bytes half of the media boundary.
 *
 * Binaries go to IndexedDB, keyed by `MediaAsset.id`; only metadata reaches the
 * DemoStore. See `types.ts` for why localStorage is the wrong place for these.
 *
 * IndexedDB is used directly rather than through a wrapper library: the access
 * pattern here is a plain key/value get/put/delete over one object store, which
 * does not justify a dependency.
 *
 * Object URLs created by `objectUrl()` are owned by the CALLER, which must call
 * `URL.revokeObjectURL` when the element unmounts. Failing to do so leaks the
 * blob for the lifetime of the document — the React hooks in this domain
 * handle that in their cleanup.
 */

const DB_NAME = "ava:media";
const DB_VERSION = 1;
const STORE = "blobs";

/** Rejects rather than hangs when IndexedDB is unavailable (e.g. private mode). */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the media database."));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Media operation failed."));
        tx.oncomplete = () => db.close();
      }),
  );
}

export interface BlobStore {
  put(id: string, bytes: ArrayBuffer, mimeType: string): Promise<void>;
  get(id: string): Promise<Blob | undefined>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const indexedDbBlobStore: BlobStore = {
  async put(id, bytes, mimeType) {
    await withStore("readwrite", (store) => store.put(new Blob([bytes], { type: mimeType }), id));
  },
  async get(id) {
    const value = await withStore<Blob | undefined>("readonly", (store) => store.get(id));
    return value instanceof Blob ? value : undefined;
  },
  async remove(id) {
    await withStore("readwrite", (store) => store.delete(id));
  },
  async clear() {
    await withStore("readwrite", (store) => store.clear());
  },
};

/**
 * In-memory fallback.
 *
 * Used when IndexedDB is unavailable — notably jsdom, where tests must still
 * exercise the upload path. Deliberately NOT persistent: pretending a blob
 * survived a reload when it did not would be exactly the kind of dishonest
 * behaviour the rest of this codebase avoids.
 */
export function createMemoryBlobStore(): BlobStore {
  const map = new Map<string, Blob>();
  return {
    async put(id, bytes, mimeType) {
      map.set(id, new Blob([bytes], { type: mimeType }));
    },
    async get(id) {
      return map.get(id);
    },
    async remove(id) {
      map.delete(id);
    },
    async clear() {
      map.clear();
    },
  };
}

let active: BlobStore | undefined;

/** Returns the blob store for this environment, falling back when needed. */
export function getBlobStore(): BlobStore {
  if (active) return active;
  active = typeof indexedDB === "undefined" ? createMemoryBlobStore() : indexedDbBlobStore;
  return active;
}

/** Test seam: swap the blob store, or pass `undefined` to restore detection. */
export function setBlobStore(store: BlobStore | undefined): void {
  active = store;
}
