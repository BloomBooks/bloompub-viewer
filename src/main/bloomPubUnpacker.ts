import * as fs from "fs";
import * as temp from "temp";
import * as Path from "path";
import * as jszip from "jszip";

// Track which BloomPUBs have been unpacked and where
const unpackedBloomPubs = new Map<string, string>();

let unpackCountThisRun = 0;
export async function unpackBloomPub(
  zipFilePath: string
): Promise<{ zipPath: string; unpackedToFolderPath: string; htmPath: string }> {
  if (zipFilePath.indexOf("crash") > 0)
    throw new Error("This is a test of the error handling system.");

  // Check if we've unpacked this before
  const existingPath = unpackedBloomPubs.get(zipFilePath);
  if (existingPath && fs.existsSync(existingPath)) {
    console.log(`Book already unpacked at ${existingPath}`);
    return prepareResponse(existingPath, zipFilePath);
  }

  const unpackedFolder = temp.mkdirSync("bloomPUB-viewer-");

  unpackCountThisRun++;
  // It's important that we not be doing this any more than necessary, so leave
  // this in the code, it doesn't ever need to be commented out.
  console.log(
    "!!!!!!!!!Unpacking operation " +
      unpackCountThisRun +
      " for " +
      zipFilePath +
      " to " +
      unpackedFolder
  );
  return new Promise((resolve, reject) => {
    fs.readFile(zipFilePath, (err, data) => {
      if (err) {
        console.log("Error reading file: " + err);
        reject({ zipPath: zipFilePath, htmPath: null });
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
            unpackedBloomPubs.set(zipFilePath, unpackedFolder);
            resolve(prepareResponse(unpackedFolder, zipFilePath));
          });
        });
      });
    });
  });
}
function prepareResponse(unpackedFolder: string, zipFilePath: string) {
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
    zipPath: zipFilePath,
    unpackedToFolderPath: unpackedFolder,
    htmPath: Path.join(unpackedFolder, filename).replace(/\\/g, "/"),
  };
}
