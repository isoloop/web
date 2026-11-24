# js-bench's runner (README.md): Playwright's official image at playwright's
# exact version (package.json), with the browsers it ships, plus Node 26.13.1
# exactly (what the 0.1.0 baseline ran) and pnpm, installed with npm at the
# repo's packageManager version: Node 25+ no longer ships corepack. Moving to a
# new Playwright or Node is a generation change: run the last release again.
FROM mcr.microsoft.com/playwright:v1.65.0-noble
RUN set -eux; \
  apt-get update; apt-get install -y --no-install-recommends curl ca-certificates xz-utils; \
  rm -rf /var/lib/apt/lists/*; \
  cd /tmp; \
  f=node-v26.13.1-linux-x64.tar.xz; \
  curl -fsSLO "https://nodejs.org/dist/v26.13.1/$f"; \
  echo "5c063e46bab0fbc1c17cc445d7ff129cbdcd0471be6ed83b6ab864f8143bc864  $f" | sha256sum -c -; \
  tar -xJf "$f" -C /usr/local --strip-components=1; \
  rm -f "$f"; \
  node --version; \
  npm install -g --no-fund --no-audit pnpm@12.16.1; \
  pnpm --version
WORKDIR /work
