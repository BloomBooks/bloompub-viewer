/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: "development" | "production" | "test";
  }
}

// Path to the static files folder, set by webpack's DefinePlugin in development and
// by src/main/index.ts in production. Declared as a global `var` so it is reachable
// both bare and as `global.__static`; NodeJS.Global no longer exists in @types/node.
declare var __static: string;

declare module "*.bmp" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  import * as React from "react";

  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement>
  >;

  const src: string;
  export default src;
}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.module.sass" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Plain stylesheets are imported for their side effect only (webpack's css-loader
// injects them). TS 6 rejects a side-effect import it cannot resolve (TS2882), so
// these need declaring even though nothing reads a value from them.
// MUST stay below "*.module.css": both patterns have an empty prefix, so TS breaks
// the tie by declaration order, and declaring this one first would shadow the
// module-css rule above and silently type those imports as `any`.
declare module "*.css";

// This interface is implemented in preload.ts.
interface Window {
  bloomPubViewMainApi: {
    sendSync: (channel: string, ...arg: any) => any;
    send: (channel: string, ...arg: any) => void;
    // Returns nothing: the listener is registered for the life of the window and
    // there is no way to remove it again. Declared `void` rather than `any` so that
    // treating the result as an unsubscribe function is a compile error, not a
    // silently-dead cleanup.
    receive: (channel: string, func: (...args: any[]) => void) => void;
    openLibrary: () => void;
    openDownloadPage: (downloadLink: string) => void;
    openSIL: () => void;
    addRecentDocument: (bloomPubPath: string) => void;
    quit: () => void;
    setApplicationMenu: (
      template: Electron.MenuItemConstructorOptions[]
    ) => void;
    showOpenDialog: (options: any, func: (filePath: string) => void) => void;
    getCurrentAppVersion: () => string;
    getRecentBooks: () => Array<RecentBook>;
    addRecentBook: (book: RecentBook) => void;
  };
}

interface RecentBook {
  path: string;
  title: string;
  thumbnail?: string;
}
