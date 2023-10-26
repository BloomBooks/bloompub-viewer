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
1. Commit, push. Push a vX.X.X tag.
   - A Github Action will build an installer for Windows and create an unpublished "Release" on Github.
1. Edit the draft release at https://github.com/BloomBooks/bloompub-viewer/releases/ and publish it.
1. Run the build at https://build.palaso.org/buildConfiguration/Bloom_SignBloomPUBInstaller to download and sign the installer.
1. Download the signed installer from TeamCity and upload it to the release on Github, replacing the existing installer.
   - Unfortunately, the way TeamCity downloads the installer, it gets the latest published, non-draft, non-prerelease version. So there is a small window of time where we have published the release but not yet updated it with a signed installer. There may be some way to improve this.
1. Users will be notified of the new version via toast on the next run.
