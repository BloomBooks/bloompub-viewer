# BloomPUB Viewer

> A desktop viewer for BloomPUB books

## Building

This repo uses [Vite+](https://viteplus.dev/) (`vp`) to manage the Node and pnpm
versions. Install it once (see the [Vite+ install guide](https://viteplus.dev/guide/)),
and it will automatically use the Node version from `.node-version` and the pnpm
version from the `packageManager` field in `package.json`.

```bash
# install dependencies
vp install

# serve with hot reload
vp run dev
```

## Releasing

1. Change the version in `package.json`.
1. Commit, push.
1. Push a vX.X.X tag.
   - A [Github Action](/.github/workflows/main.yml) will build an installer for Windows and create an unpublished "Release" on Github.
1. Edit the draft release at https://github.com/BloomBooks/bloompub-viewer/releases/ and publish it.
1. Users will be notified of the new version via toast on the next run.
