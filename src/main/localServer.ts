import * as http from "http";
import * as Path from "path";
import { randomBytes } from "crypto";
import send from "send";
import { resolveRequestedFile } from "./bookFileResolver";

// bloom-player and the books it shows are served to the renderer over plain HTTP from
// this server, bound to the loopback interface on a random port. Chromium treats any
// non-file:// scheme like HTTP and expects range requests, content types and the rest to
// be handled by the server; a real HTTP server (via the `send` library, the same one
// express uses) gives us all of that for free, which is what lets <video> seek.
//
// Every URL carries a random token as its first path segment. Only the renderer knows
// it, so another process on this machine that finds the port cannot read files through us.

export type ServerContext = {
  currentPrimaryBloomPubPath: string | undefined;
  currentUnpackedBookFolder: string | undefined;
};

let origin: string | undefined;

export function getLocalServerOrigin(): string | undefined {
  return origin;
}

export function startLocalServer(
  getContext: () => ServerContext,
): Promise<string> {
  const token = randomBytes(16).toString("hex");
  const server = http.createServer((req, res) => {
    handle(req, res, token, getContext()).catch((error) => {
      console.error(`Error serving ${req.url}: ${error}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Local server did not report a port"));
        return;
      }
      origin = `http://127.0.0.1:${address.port}/${token}`;
      console.log("Local book server listening at " + origin);
      resolve(origin);
    });
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  token: string,
  context: ServerContext,
) {
  const url = req.url ?? "/";
  const tokenPrefix = `/${token}/`;
  if (!url.startsWith(tokenPrefix)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const urlPath = url.substring(tokenPrefix.length - 1); // keep the leading slash
  console.log(
    "book server request: " +
      urlPath +
      (req.headers.range ? ` [${req.headers.range}]` : ""),
  );

  const resolved = await resolveRequestedFile(
    urlPath,
    context.currentPrimaryBloomPubPath ?? "",
    context.currentUnpackedBookFolder ?? "",
  );
  if ("notFound" in resolved) {
    res.writeHead(404);
    res.end();
    return;
  }

  // `send` wants a root plus a URL-encoded path under it. Handing it the folder as root
  // and only the file name as the path keeps its own ".." protection meaningful and lets
  // it do the rest: Range/206, Content-Type, Last-Modified, HEAD, 404.
  const filePath = resolved.filePath;
  send(req, "/" + encodeURIComponent(Path.basename(filePath)), {
    root: Path.dirname(filePath),
    index: false,
    dotfiles: "allow",
    cacheControl: false,
  })
    .on("error", (error: NodeJS.ErrnoException & { status?: number }) => {
      if (error.status !== 404) {
        console.error(`Error sending ${filePath}: ${error}`);
      }
      if (!res.headersSent) res.writeHead(error.status ?? 500);
      res.end();
    })
    .pipe(res);
}
