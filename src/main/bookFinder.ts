import * as fs from "fs";
import * as path from "path";
import * as jszip from "jszip";

interface BloomPubMeta {
  bookInstanceId: string;
  // Add other meta properties as needed
}

export async function getBloomPUBPathFromId(
  bookId: string,
  folderToSearch: string
): Promise<string | undefined> {
  const normalizedFolderToSearch = normalizePath(folderToSearch);
  // Possible Enhancement: Currently we only update the cache
  // when you open a book that is in a different folder.
  // In a dynamic situation where books are added/removed/modified while the viewer is open,
  // we could do it more often, e.g. every time we open a book.

  if (normalizedFolderToSearch !== currentRootFolderPath) {
    await updateBookCache(normalizedFolderToSearch);
  }

  for (const [filePath, entry] of Object.entries(
    cachedBookIdsForCurrentRootFolder
  )) {
    if (entry.bookId === bookId) {
      return filePath;
    }
  }

  return undefined;
}

/* It's a bit counterintuitive to use paths as the keys instead of the the book instance ids,
but it has some advantages:
* Easy to clean up stale entries (just check if file exists at path)
* Natural for file system operations
* No possibility of GUID collisions if same book exists in multiple locations
*/
interface BookIdCache {
  [filePath: string]: {
    bookId: string;
    lastModified: number;
  };
}

let currentRootFolderPath: string | undefined;
let cachedBookIdsForCurrentRootFolder: BookIdCache = {};

function loadCache(rootFolderPath: string): BookIdCache {
  const cachePath = normalizePath(
    path.join(rootFolderPath, ".bloompubViewer-bookId-cache.json")
  );
  try {
    const cacheContent = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(cacheContent);
  } catch (error) {
    console.error("Error reading cache file:", error);
    return {};
  }
}

function saveCache(rootFolderPath: string, cache: BookIdCache): void {
  const cachePath = path.join(
    rootFolderPath,
    ".bloompub-viewer-bookId-cache.json"
  );
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Error saving cache file:", error);
    // If we can't save the cache, just continue with in-memory cache
  }
}

async function getBookIdFromBloomPUB(
  bloomPubPath: string
): Promise<string | undefined> {
  try {
    const zipData = fs.readFileSync(bloomPubPath);
    const zip = await jszip.loadAsync(zipData);
    const metaFile = zip.file("meta.json");
    if (!metaFile) return undefined;

    const metaContent = await metaFile.async("string");
    const meta = JSON.parse(metaContent) as BloomPubMeta;
    return meta.bookInstanceId;
  } catch (error) {
    console.error(`Error reading BloomPUB at ${bloomPubPath}:`, error);
    return undefined;
  }
}

async function updateBookCache(rootFolderPath: string): Promise<void> {
  if (!fs.existsSync(rootFolderPath)) {
    throw new Error(`Folder not found: ${rootFolderPath}`);
  }

  let cache = loadCache(rootFolderPath);
  let cacheModified = false;

  const files = fs
    .readdirSync(rootFolderPath)
    .filter(
      (f) =>
        f.toLowerCase().endsWith(".bloompub") ||
        f.toLowerCase().endsWith(".bloomd")
    );

  // Remove cached entries for files that no longer exist
  Object.keys(cache).forEach((filePath) => {
    if (!fs.existsSync(filePath)) {
      delete cache[filePath];
      cacheModified = true;
    }
  });

  // Check each bloomPUB file
  for (const file of files) {
    const fullPath = normalizePath(path.join(rootFolderPath, file));

    const stats = fs.statSync(fullPath);
    const lastModified = stats.mtimeMs;

    if (!cache[fullPath] || cache[fullPath].lastModified !== lastModified) {
      const fileBookId = await getBookIdFromBloomPUB(fullPath);
      if (fileBookId) {
        console.log("*********addding file: " + fullPath);
        cache[fullPath] = { bookId: fileBookId, lastModified };
        cacheModified = true;
      }
    }
  }

  if (cacheModified) {
    console.log(`Updating cache for folder: ${rootFolderPath}`);
    saveCache(rootFolderPath, cache);
  }
  currentRootFolderPath = rootFolderPath;
  cachedBookIdsForCurrentRootFolder = cache;
}

function normalizePath(filePath: string): string {
  if (!filePath) throw new Error("File path cannot be empty");
  return path.normalize(filePath).replace(/\\/g, "/");
}
