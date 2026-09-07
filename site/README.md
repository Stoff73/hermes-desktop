# site/

The public download page for Hermes One, served at <https://csjones.co/hermes>.

`download/index.html` is a single self-contained file — no build step, no
dependencies. It reads GitHub's releases API at load time and links to the
assets on the latest release, so it never needs redeploying when a new version
ships. The installers themselves are hosted by GitHub Releases; nothing but this
page lives on csjones.co.

## Deploy

Upload the one file to the docroot (SiteGround, same box as `csjones.co/fynla`):

```bash
scp -P 18765 -i ~/.ssh/fynlaDev site/download/index.html \
  u163-ptanegf9edny@ssh.csjones.co:~/www/csjones.co/hermes/index.html
```

Create `~/www/csjones.co/hermes/` first if it isn't there.

## What it shows

macOS (Apple Silicon and Intel) and Windows (installer and portable), picked out
of the release assets by filename. It detects the visitor's platform for the
primary button and lists every build underneath.

When GitHub is unreachable, or when a release has none of those assets, the
button degrades to a link to the releases page rather than failing silently.

## Signing

The mac builds are signed with a Developer ID Application certificate and
notarised by Apple, so they open on a double-click with no Gatekeeper warning
and the page needs no "right-click → Open" instructions. Windows is unsigned
and still shows a SmartScreen prompt.
