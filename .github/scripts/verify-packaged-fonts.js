// Verify the fonts we ship actually reached the packaged app.
//
// The CI steps before this one only prove webpack staged the fonts into
// dist/electron/; electron-builder could still leave them out of what ships.
// This looks inside the packed app itself.
//
// Do NOT try to do this by grepping the .asar. The six file names also appear
// inside main.js (the shippedFontFiles array) and index.html (the @font-face
// rules), both of which are themselves in the archive, so a grep passes even
// with every font deleted -- exactly the failure it is supposed to catch.
// Read the header's file table instead: an asar begins with four little-endian
// uint32s, the last of which (at byte 12) is the length of the JSON file table
// that starts at byte 16.
//
// Usage: node .github/scripts/verify-packaged-fonts.js <path to app.asar>

const fs = require("fs");

const FACES = [
  "Andika-Regular",
  "Andika-Bold",
  "Andika-Italic",
  "Andika-BoldItalic",
  "ABeeZee-Regular",
  "ABeeZee-Italic",
].map((f) => f + ".woff2");

const FONT_DIR = ["dist", "electron", "static", "fonts"];

function readFileTable(asarPath) {
  const fd = fs.openSync(asarPath, "r");
  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    const jsonLength = header.readUInt32LE(12);
    const json = Buffer.alloc(jsonLength);
    fs.readSync(fd, json, 0, jsonLength, 16);
    return JSON.parse(json.toString("utf8"));
  } finally {
    fs.closeSync(fd);
  }
}

const asarPath = process.argv[2];
if (!asarPath) {
  console.log("::error::usage: verify-packaged-fonts.js <path to app.asar>");
  process.exit(1);
}

let node = readFileTable(asarPath);
for (const segment of FONT_DIR) {
  node = node && node.files && node.files[segment];
  if (!node) {
    console.log(
      `::error::${FONT_DIR.join("/")} is missing from ${asarPath} (no ${segment}/)`
    );
    process.exit(1);
  }
}

let missing = 0;
for (const face of FACES) {
  const entry = node.files[face];
  if (!entry || !entry.size) {
    console.log(`::error::${face} is missing from ${asarPath}`);
    missing++;
  }
}
if (missing) process.exit(1);

console.log(`All ${FACES.length} faces are inside ${asarPath}.`);
