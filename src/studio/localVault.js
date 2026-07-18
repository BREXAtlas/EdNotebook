const DB_NAME = "ednotebook-device-vault";
const DB_VERSION = 1;
const STORE = "files";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support device-only storage."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Unable to open the device vault."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("courseId", "courseId");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transact(mode, action) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let request;
        try {
          request = action(store);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }

        request.onerror = () => reject(request.error || new Error("Device vault operation failed."));
        request.onsuccess = () => resolve(request.result);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => reject(transaction.error || new Error("Device vault transaction failed."));
      })
  );
}

export async function saveDeviceFile(file, metadata = {}) {
  const id = metadata.id || crypto.randomUUID();
  const record = {
    id,
    blob: file,
    originalName: file.name,
    safeName: metadata.safeName || file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    title: metadata.title || file.name,
    description: metadata.description || "",
    placement: metadata.placement || "private-vault",
    courseId: metadata.courseId || null,
    checksumSha256: metadata.checksumSha256 || null,
    createdAt: metadata.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
  };
  await transact("readwrite", (store) => store.put(record));
  return record;
}

export async function listDeviceFiles(courseId) {
  const records = await transact("readonly", (store) => store.getAll());
  return records
    .filter((record) => !courseId || record.courseId === courseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDeviceFile(id) {
  return transact("readonly", (store) => store.get(id));
}

export function deleteDeviceFile(id) {
  return transact("readwrite", (store) => store.delete(id));
}

export async function downloadDeviceFile(id) {
  const record = await getDeviceFile(id);
  if (!record) throw new Error("The device-only file could not be found on this browser.");
  const url = URL.createObjectURL(record.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = record.safeName || record.originalName || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return record;
}

export async function getDevicePreviewUrl(id) {
  const record = await getDeviceFile(id);
  if (!record) return null;
  return { record, url: URL.createObjectURL(record.blob) };
}
