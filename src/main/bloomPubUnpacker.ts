import { app, ipcMain } from "electron";
import Store from "electron-store";
import * as fs from "fs";
import * as temp from "temp";
import * as Path from "path";
import * as jszip from "jszip";

// Track which BloomPUBs have been unpacked and where
const unpackedBloomPubs = new Map<string, string>();

const store = new Store<StoreSchema>({
  name: "bloompub-viewer-prefs",
  defaults: {
    recentBooks: [],
  },
});

let unpackCountThisRun = 0;

export async function unpackBloomPub(
  bloomPubPath: string,
  addToRecentBooks = true
): Promise<{
  bloomPubPath: string;
  unpackedToFolderPath: string | undefined;
  htmPath: string | undefined;
}> {
  if (bloomPubPath.indexOf("crash") > 0)
    throw new Error("This is a test of the error handling system.");

  // if that path doesn't exist, remove from recents (if it's there) and return undefined
  if (!fs.existsSync(bloomPubPath)) {
    const recentBooks = store.get("recentBooks");
    const updatedRecentBooks = recentBooks.filter(
      (b) => b.path !== bloomPubPath
    );
    store.set("recentBooks", updatedRecentBooks);
    return Promise.resolve({
      bloomPubPath,
      unpackedToFolderPath: undefined,
      htmPath: undefined,
    });
  }
  // Check if we've unpacked this before
  const existingPath = unpackedBloomPubs.get(bloomPubPath);
  if (existingPath && fs.existsSync(existingPath)) {
    console.log(`Book already unpacked at ${existingPath}`);
    return prepareResponse(existingPath, bloomPubPath);
  }

  const unpackedFolder = temp.mkdirSync("bloomPUB-viewer-");

  unpackCountThisRun++;
  // It's important that we not be doing this any more than necessary, so leave
  // this in the code, it doesn't ever need to be commented out.
  console.log(
    "!!!!!!!!!Unpacking operation " +
      unpackCountThisRun +
      " for " +
      bloomPubPath +
      " to " +
      unpackedFolder
  );
  return new Promise((resolve, reject) => {
    fs.readFile(bloomPubPath, (err, data) => {
      if (err) {
        console.log("Error reading file: " + err);
        reject({ bloomPubPath, htmPath: null });
        return;
      }

      const directories: Set<string> = new Set<string>();
      directories.add(unpackedFolder);

      jszip.loadAsync(data).then(function (zip) {
        Promise.all(
          Object.keys(zip.files).map(function (filename) {
            const file = zip.files[filename];
            return file.async("nodebuffer").then(function (content) {
              return { filename, content };
            });
          })
        ).then(function (files) {
          Promise.all(
            files.map(function (file) {
              const dest = Path.join(unpackedFolder, file.filename);
              const dir = Path.dirname(dest);
              if (!directories.has(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                directories.add(dir);
              }

              return new Promise<void>(function (resolve, reject) {
                fs.writeFile(dest, file.content, function (err) {
                  if (err) reject(err);
                  else resolve();
                });
              });
            })
          ).then(function () {
            unpackedBloomPubs.set(bloomPubPath, unpackedFolder);
            if (addToRecentBooks) addRecentBook(bloomPubPath, unpackedFolder);
            resolve(prepareResponse(unpackedFolder, bloomPubPath));
          });
        });
      });
    });
  });
}
function prepareResponse(unpackedFolder: string, bloomPubPath: string) {
  // start by expecting the main file to be index.htm
  let filename: string | undefined = "index.htm";
  if (!fs.existsSync(Path.join(unpackedFolder, filename))) {
    // some old files may have been created with a different html file name
    // so we'll look for the first html file we find
    filename = fs
      .readdirSync(unpackedFolder)
      .find((f) => Path.extname(f) === ".htm");
    if (!filename) {
      throw new Error("No .htm file found in that book");
    }
  }
  return {
    bloomPubPath,
    unpackedToFolderPath: unpackedFolder,
    htmPath: Path.join(unpackedFolder, filename).replace(/\\/g, "/"),
  };
}

function addRecentBook(bloomPubPath: string, unpackedFolder: string) {
  // tell the OS that we opened this file for use in docks and such
  app.addRecentDocument(bloomPubPath);

  const stringEncodedThumbnail = getThumbnailEncodedAsString(unpackedFolder);

  const normalizedPath = bloomPubPath.replace(/\\/g, "/");
  const bookInfo = {
    path: bloomPubPath,
    title: Path.basename(normalizedPath, Path.extname(normalizedPath)).replace(
      /\+/g,
      " "
    ),
    thumbnail: stringEncodedThumbnail,
  };

  // add or update, making this the first one in the list
  let recentBooks = store.get("recentBooks");
  recentBooks = recentBooks.filter((b) => b.path !== bookInfo.path);
  recentBooks.unshift(bookInfo);
  recentBooks = recentBooks.slice(0, 6);
  store.set("recentBooks", recentBooks);
}

function getThumbnailEncodedAsString(unpackedFolder: string): string {
  // Try PNG first
  const pngPath = Path.join(unpackedFolder, "thumbnail.png");
  if (fs.existsSync(pngPath)) {
    try {
      console.log("reading thumbnail:", pngPath);
      const thumbBuffer = fs.readFileSync(pngPath);
      return `data:image/png;base64,${thumbBuffer.toString("base64")}`;
    } catch (error) {
      console.log("Error reading thumbnail:", error);
    }
  }

  // Try JPG if PNG doesn't exist
  const jpgPath = Path.join(unpackedFolder, "thumbnail.jpg");
  if (fs.existsSync(jpgPath)) {
    try {
      console.log("reading thumbnail:", jpgPath);
      const thumbBuffer = fs.readFileSync(jpgPath);
      return `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;
    } catch (error) {
      console.log("Error reading thumbnail:", error);
    }
  }

  return "";
}
interface StoreSchema {
  recentBooks: Array<{
    path: string;
    title: string;
    thumbnail?: string;
  }>;
}
ipcMain.on("get-recent-books", (event) => {
  event.returnValue = store
    .get("recentBooks")
    .filter((b) => fs.existsSync(b.path));
});
