import { unpackBloomPub } from "./bloomPubUnpacker";
import { getBloomPUBPathFromId } from "./bookFinder";
import fs from "fs";
import * as Path from "path";

// decodeURIComponent throws on a malformed escape such as "%E0%A4" or a stray "%".
// A book URL is untrusted input, so never let that exception escape: fall back to the
// text as it came, which will simply fail to match a file and 404.
export function decodeUriComponentSafely(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// True when `filePath` is `folder` itself or something inside it, after resolving
// any ".." segments. Used to keep a decoded resource name from walking out of a book.
export function isPathInside(folder: string, filePath: string): boolean {
  const relative = Path.relative(Path.resolve(folder), Path.resolve(filePath));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(".." + Path.sep) &&
      !Path.isAbsolute(relative))
  );
}

// When a book links to another book, it uses the /book/ prefix (see bloom-player Readme for more info).
// This handles finding the bloompub, unpacking it if necessary,
// and returning the path to the requested resource.
export async function getPathToResourceFromAnotherBook(
  request: GlobalRequest,
  folderToSearch: string
): Promise<string | undefined> {
  const i = request.url.indexOf("/book/");
  if (i < 0) {
    return undefined;
  }

  // typical requestUrl will be "bpub://bloom-player/book/2c1b71ac-f399-446d-8398-e61a8efd4e83/index.htm"
  // extract out the book id, which is the part after "book/" that ends with a #, a parameter, or a slash
  // get a second capture group that matches the requested file, e.g., "index.htm"
  const match = request.url.match(/book\/([^#?/]+)\/(.+)/);

  if (!match) {
    console.log("No book id found in urlPath: " + request.url);
    return undefined;
  }
  const bookId = match[1];
  // The URL may carry a query or fragment and percent-encoded characters (spaces,
  // non-ASCII letters). Neither belongs in a file name: strip and decode them the way
  // a file:// load would.
  const requestedFile = decodeUriComponentSafely(
    match[2].replace(/[?#].*$/, ""),
  );
  console.log(`asking for ${bookId} with file ${requestedFile}`);

  const bookPath = await getPathToBookUnpackIfNeeded(bookId, folderToSearch);

  if (bookPath) {
    console.log("Have book at: " + bookPath);

    // Bloom Player will always request an index.htm. Unfortunately bloomPUB does not require the html
    // file to have a certain name. So we need to search for an htm file in the book folder.
    let fileNameToFetch: string | undefined = requestedFile;
    if (
      requestedFile === "index.htm" &&
      !fs.existsSync(bookPath + "/" + requestedFile)
    ) {
      fileNameToFetch = fs
        .readdirSync(bookPath)
        .find((f) => Path.extname(f) === ".htm");
      if (!fileNameToFetch) {
        console.error(`No .htm file found in book folder: ${bookPath}`);
        return undefined;
      }
    }

    const filePath = Path.resolve(bookPath, fileNameToFetch);
    // The name came from the book's own HTML, percent-decoded, so "..%2F..%2Fetc" would
    // otherwise walk out of the unpacked book and read an arbitrary local file.
    if (!isPathInside(bookPath, filePath)) {
      console.error(
        `Refusing to serve ${filePath}, which lies outside the linked book at ${bookPath}`,
      );
      return undefined;
    }
    console.log("Will request filePath: " + filePath);
    return filePath;
  } else {
    console.error(`Failed to get book path for ID: ${bookId}`);
    return undefined;
  }
}

const bookIdToUnpackedFolder: { [key: string]: string } = {};

// Because we can get multiple requests for a new book all at once
// (typically for .distribution, meta.json, and .htm) we use
// this to make sure we aren't unpacking the same book multiple times.
const ongoingUnpackOperations: Map<
  string,
  Promise<string | undefined>
> = new Map();

async function getPathToBookUnpackIfNeeded(
  bookId: string,
  folderToSearch: string
): Promise<string | undefined> {
  if (!bookId?.trim() || !folderToSearch?.trim()) {
    console.error("Invalid bookId or folderToSearch");
    return undefined;
  }

  // if the book is already unpacked, just return the path to the .htm file
  if (bookId in bookIdToUnpackedFolder) {
    return bookIdToUnpackedFolder[bookId];
  }

  // Check if there's already an ongoing unpack operation for this book
  const existingOperation = ongoingUnpackOperations.get(bookId);
  if (existingOperation) {
    console.log("Waiting for existing unpack operation for book id: " + bookId);
    return existingOperation;
  }

  console.log("No book found in cache for book id: " + bookId);
  const boomPUBPath = await getBloomPUBPathFromId(bookId, folderToSearch);
  if (!boomPUBPath) {
    console.log("No bloomPUB found for book id: " + bookId);
    return "";
  }

  console.log("*****Unpacking bloomPUB for book id: " + bookId);

  // Create a new unpack operation and store it in the Map
  const unpackOperation = (async () => {
    try {
      const result = await unpackBloomPub(boomPUBPath, false);
      if (!result?.unpackedToFolderPath) {
        throw new Error("Unpacking failed");
      }
      bookIdToUnpackedFolder[bookId] = result.unpackedToFolderPath;
      return result.unpackedToFolderPath;
    } catch (error) {
      console.error(`Error unpacking book: ${error}`);
      return undefined;
    } finally {
      // Clean up the ongoing operation when done
      ongoingUnpackOperations.delete(bookId);
    }
  })();

  ongoingUnpackOperations.set(bookId, unpackOperation);
  return unpackOperation;
}
