/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace NodeJS {
  interface Global {
    __static: string;
  }
  interface ProcessEnv {
    readonly NODE_ENV: "development" | "production" | "test";
  }
}

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

// This interface is implemented in preload.ts.
interface Window {
  bloomPubViewMainApi: {
    sendSync: (channel: string, ...arg: any) => any;
    send: (channel: string, ...arg: any) => void;
    receive: (channel: string, func) => any;
    openLibrary: () => void;
    openDownloadPage: (downloadLink: string) => void;
    addRecentDocument: (bloomPubPath: string) => void;
    quit: () => void;
    setApplicationMenu: (template: Array<any>) => void;
    showOpenDialog: (options: any, func) => void;
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
