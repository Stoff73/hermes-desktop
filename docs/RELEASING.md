# Releasing

Cutting a release is: bump the version on `main`, then fast-forward `release`
onto it. The `release` branch is a trigger, never a place to work.

## The procedure

```bash
# 1. Everything you want in the release is merged to main.
git checkout main && git pull

# 2. Bump the version in package.json and package-lock.json (both), commit, push.
#    The workflow reads package.json and tags v<version>.
git commit -am "chore(release): X.Y.Z" && git push origin main

# 3. Fast-forward release onto main. This is what starts the build.
git checkout release
git merge --ff-only main
git push origin release
```

`--ff-only` is the point: if it refuses, `release` has picked up work that
isn't on `main` and needs merging back before you go further. The workflow
enforces the same rule in its first job and fails the run with the commands to
fix it, so a drifted branch can't quietly ship code that never landed on
`main`.

## What the workflow does

Builds macOS (arm64 + x64), Windows (installer + portable) and Linux
(AppImage, deb, rpm), then publishes them to a GitHub Release tagged
`v<version>` along with the `latest*.yml` files the auto-updater reads.

A tag that already exists short-circuits the run, so re-pushing `release`
without a version bump is a no-op rather than a duplicate release.

`workflow_dispatch` runs a **dry run** by default: it builds everything and
skips publishing. Use it to prove a build before committing to a version.

## Signing

macOS builds are signed with a Developer ID Application certificate and
notarised by Apple. Five repository secrets drive it:

| Secret | What it is |
| --- | --- |
| `CSC_LINK` | base64 of the Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | the password on that `.p12` |
| `ASC_API_KEY` | base64 of the App Store Connect `.p8` |
| `ASC_KEY_ID` | that key's id |
| `ASC_ISSUER_ID` | the team's issuer UUID |

Verify the pair before spending a build on them:

```bash
# Does the .p12 password actually open it? (openssl 3 needs -legacy for
# Keychain exports and will lie to you otherwise — use security instead.)
KC=$TMPDIR/verify.keychain
security create-keychain -p temp123 "$KC"
security import path/to/developer-id.p12 -k "$KC" -P "$PASSWORD" && echo OK
security delete-keychain "$KC"

# Do the notarisation credentials authenticate?
xcrun notarytool history --key path/to/AuthKey_XXX.p8 \
  --key-id XXX --issuer <issuer-uuid>
```

The mac jobs are pinned to `macos-15`. On `macos-latest` (now macOS 26) signing
fails with `SecKeychainUnlock: The user name or passphrase you entered is not
correct` — electron-builder passes the `.p12` password to
`security set-key-partition-list`, which wants the keychain's own
(randomly generated) password. It only bites once that keychain is locked, and
the message blames the password rather than the lock. Don't chase the password.

Windows builds are unsigned and show a SmartScreen prompt; that needs a
separate paid code-signing certificate.

## The download page

<https://csjones.co/hermes> reads the releases API at load time, so a release
needs no site deploy. See [`site/README.md`](../site/README.md).
