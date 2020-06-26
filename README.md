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

1. Update the `version` in package.json.
1. Commit.
1. Add a tag of the form "v.1.2.3" to your commit and push them both to github.
1. `yarn release` will create a draft release on github with the windows exe. 
1. Go to https://github.com/BloomBooks/bloompub-viewer/releases/ , edit that draft, and publish it.
1. Users will be notified of the new version via toast on the next run.
