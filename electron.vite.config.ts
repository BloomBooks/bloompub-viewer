import { resolve } from "node:path";
import fs from "node:fs";
import { builtinModules } from "node:module";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

const root = __dirname;
const outDir = resolve(root, "dist/electron");

// Bundle every dependency into main.js / preload.js, leaving only electron itself
// and Node's own builtins to be required at runtime. electron-vite would otherwise
// externalize everything in "dependencies", which webpack did not -- and it would
// break the packaged app, because electron-builder.json5 ships only
// "dist/electron/**/*" with no node_modules for those requires to resolve against.
// A predicate, not an array, on purpose: Vite MERGES array config by concatenation,
// so an array here would be appended to electron-vite's own external list (which
// contains every "dependencies" entry) and nothing would ever get bundled. A
// function replaces that list outright.
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);
const isRuntimeOnlyExternal = (id: string): boolean =>
  id === "electron" || id.startsWith("electron/") || nodeBuiltins.has(id);

// Everything -- main, preload, renderer, bloom-player and the fonts -- lands in a
// single flat dist/electron, rather than electron-vite's default out/{main,preload,
// renderer}. That is not cosmetic: at runtime bpubProtocolHandler resolves
// bloom-player from `__dirname` (the folder holding main.js) in production, main
// loads ./index.html relative to itself, and electron-builder ships only
// "dist/electron/**/*". Splitting the output would break all three.

/** Clear dist/electron once, before the first of the three builds writes to it. */
function cleanOutDir(): Plugin {
  return {
    name: "bloompub-clean-out-dir",
    buildStart() {
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
    // main and preload are built as Vite "ssr" environments, where dependency
    // externalization is decided by ssr.noExternal -- rollupOptions.external alone
    // does not bundle them. Both are needed: noExternal to pull deps in, and the
    // rollup external list to keep electron and node builtins out.
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
