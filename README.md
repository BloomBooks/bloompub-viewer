# BloomPUB Viewer

> A desktop viewer for bloomPUB books

## Building

```bash
# install dependencies
yarn

# serve with hot reload
yarn dev
```

## Releasing

1. Change the version in `package.json`
1. Commit, push. A github action will build an installer Windows and create an unpublished "Release" on github.
1. Go to https://github.com/BloomBooks/bloompub-viewer/releases/ , edit that draft, and publish it.
1. Users will be notified of the new version via toast on the next run.
