import { resolve } from "node:path";
import fs from "node:fs";
import { builtinModules } from "node:module";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

const root = __dirname;
const outDir = resolve(root, "dist/electron");

// main.js and preload.js must bundle every library, leaving only electron itself and
// Node's own builtins to be required at runtime: electron-builder.json5 ships just
// "dist/electron/**/*", so there is no node_modules for a stray require() to resolve
// against and the packaged app would die on startup.
//
// Two separate things achieve that, and BOTH are load-bearing:
//
//  1. package.json declares no "dependencies" at all -- every library is a
//     devDependency. electron-vite externalizes whatever it finds in "dependencies",
//     so that list being empty is what actually allows bundling. Moving a package
//     back into "dependencies" would silently drop it out of the bundle again.
//
//  2. The predicate below keeps electron and the node builtins external. It must be
//     a function, not an array: Vite MERGES array config by concatenation, so an
//     array would be appended to electron-vite's own external list rather than
//     replacing it, and nothing would bundle. (Setting ssr.noExternal instead does
//     not work -- that was tried.)
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);
const isRuntimeOnlyExternal = (id: string): boolean =>
  id === "electron" || id.startsWith("electron/") || nodeBuiltins.has(id);

// Why the "dev" script pins `--entry dist/electron/main.js`:
// electron-vite otherwise launches `electron .`, which makes Electron read the root
// package.json and set app.getAppPath() to the project root. bpubProtocolHandler
// resolves bloom-player and the Andika fonts relative to getAppPath() assuming it is
// dist/electron -- which is what it was when the old dev-runner spawned
// `electron dist/electron/main.js`. Without the pin, every player file and font 404s
// in dev, and Electron also picks up the app name from package.json, moving dev's
// userData onto the *installed* app's electron-store (clobbering real recent books).
//
// Everything -- main, preload, renderer, bloom-player and the fonts -- lands in a
// single flat dist/electron, rather than electron-vite's default out/{main,preload,
// renderer}. That is not cosmetic: at runtime bpubProtocolHandler resolves
// bloom-player from `__dirname` (the folder holding main.js) in production, main
// loads ./index.html relative to itself, and electron-builder ships only
// "dist/electron/**/*". Splitting the output would break all three.

/**
 * Clear dist/electron exactly ONCE per electron-vite process, before the first of
 * the three builds writes into it.
 *
 * The once-guard is the whole point. main, preload and renderer are separate rollup
 * builds sharing this one folder, so under `dev -w` a main-process edit re-fires
 * buildStart -- and wiping the folder then takes preload.js with it, which the
 * preload watcher does not re-emit. Electron restarts with a preload that no longer
 * exists, contextBridge never runs, and the renderer dies on
 * window.bloomPubViewMainApi.
 *
 * Note `apply: "build"` does NOT work here, which is counter-intuitive: electron-vite
 * compiles main and preload through Vite's build() API even during `dev`, so a
 * build-only plugin is still active in dev. Measured: with `apply: "build"`, editing
 * a main file under `dev -w` deleted preload.js; with this guard it survives.
 */
let outDirCleaned = false;
function cleanOutDir(): Plugin {
  return {
    name: "bloompub-clean-out-dir",
    buildStart() {
      if (outDirCleaned) return;
      outDirCleaned = true;
      fs.rmSync(outDir, { recursive: true, force: true });
    },
  };
}

/**
 * Copy the files the app reads from disk at runtime rather than importing.
 * Replaces the two CopyWebpackPlugin entries from the webpack config.
 */
function copyRuntimeAssets(): Plugin {
  return {
    name: "bloompub-copy-runtime-assets",
    closeBundle() {
      // bloom-player must be flat in dist/electron: in a packaged build
      // bpubProtocolHandler serves it from __dirname.
      fs.cpSync(resolve(root, "node_modules/bloom-player/dist"), outDir, {
        recursive: true,
      });
      // The Andika fonts, served via the bpub://.../host/fonts/ route.
      // Skip dotfiles, matching the old CopyWebpackPlugin's `ignore: [".*"]`, so
      // things like static/.gitkeep don't get shipped.
      fs.cpSync(resolve(root, "static"), resolve(outDir, "static"), {
        recursive: true,
        filter: (src) => !resolve(src).split(/[\\/]/).pop()!.startsWith("."),
      });
    },
  };
}

/**
 * The production CSP in index.html allows scripts only from 'self', which is
 * right for the shipped app (BL-8994) but blocks the inline preamble that Vite
 * and React Refresh inject when serving. Relax it for `electron-vite dev` only --
 * the built HTML is left exactly as authored.
 */
function relaxCspForDevServer(): Plugin {
  return {
    name: "bloompub-relax-csp-for-dev-server",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        "script-src-elem 'self';",
        "script-src-elem 'self' 'unsafe-inline';"
      );
    },
  };
}

export default defineConfig(({ command }) => {
  // `electron-vite dev` still builds main and preload to disk, so key off the
  // command rather than NODE_ENV: minify what we ship, keep dev output readable.
  const minify = command === "build";

  return {
  main: {
    // The copy runs here, not on the renderer, so dist/electron is complete in
    // `dev` too -- the renderer is served rather than bundled in dev, so a
    // renderer-attached closeBundle would never fire.
    plugins: [cleanOutDir(), copyRuntimeAssets()],
    build: {
      outDir,
      emptyOutDir: false, // cleanOutDir handles it; all three share this folder
      minify,
      target: "node20", // electron 30 bundles Node 20
      lib: {
        entry: resolve(root, "src/main/index.ts"),
        formats: ["cjs"],
      },
      rollupOptions: {
        external: isRuntimeOnlyExternal,
        output: { entryFileNames: "main.js" },
      },
    },
  },

  preload: {
    build: {
      outDir,
      emptyOutDir: false,
      minify,
      target: "node20",
      lib: {
        entry: resolve(root, "src/preload.ts"),
        formats: ["cjs"], // a sandboxed preload must be CommonJS
      },
      rollupOptions: {
        external: isRuntimeOnlyExternal,
        output: { entryFileNames: "preload.js" },
      },
    },
  },

  renderer: {
    root: resolve(root, "src/renderer"),
    // Relative asset URLs, because index.html is loaded over file:// in production.
    // Vite's default "/" would resolve against the filesystem root and load nothing.
    base: "./",
    plugins: [
      react({
        // Emotion's css prop. tsconfig's jsxImportSource already routes JSX to
        // @emotion/react; the babel plugin adds the source maps and component
        // labels that make emotion styles debuggable.
        jsxImportSource: "@emotion/react",
        babel: { plugins: ["@emotion/babel-plugin"] },
      }),
      relaxCspForDevServer(),
    ],
    build: {
      outDir,
      emptyOutDir: false,
      minify,
      target: "chrome124", // electron 30
      // Matches the old url-loader limit, so the same assets stay inlined as
      // data URIs and the same ones stay separate files.
      assetsInlineLimit: 10000,
      rollupOptions: {
        input: resolve(root, "src/renderer/index.html"),
      },
    },
    resolve: {
      // StartScreen.tsx imports from ../../assets, above the renderer root.
      preserveSymlinks: false,
    },
    server: {
      // Same reason: let the dev server read the repo-root assets folder.
      fs: { allow: [root] },
    },
    },
  };
});
