# BloomPUB Viewer

> A desktop viewer for BloomPUB books

## Building

```bash
# install dependencies
yarn

# serve with hot reload
yarn dev
```

## Releasing

1. Change the version in `package.json`.
1. Commit, push.
1. Push a vX.X.X tag.
   - A [Github Action](/.github/workflows/main.yml) will build an installer for Windows and create an unpublished "Release" on Github.
1. Edit the draft release at https://github.com/BloomBooks/bloompub-viewer/releases/ and publish it.
1. Users will be notified of the new version via toast on the next run.
