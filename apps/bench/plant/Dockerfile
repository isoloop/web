# plant-bench's runner (README.md): Playwright's official image at
# @playwright/test's exact version (package.json), with the browsers it ships,
# plus Node 26.13.0 exactly (the repo's engines field asks for 26) and pnpm,
# installed with npm at the repo's packageManager version: Node 25+ no longer
# ships corepack. Moving to a new Playwright is a generation change: bump
# @playwright/test and this line together.
FROM mcr.microsoft.com/playwright:v1.65.0-noble
RUN set -eux; \
  apt-get update; apt-get install -y --no-install-recommends curl ca-certificates xz-utils; \
  rm -rf /var/lib/apt/lists/*; \
  cd /tmp; \
  f=node-v26.13.0-linux-x64.tar.xz; \
  curl -fsSLO "https://nodejs.org/dist/v26.13.0/$f"; \
  echo "d28a96af6c38596f6d9d97c0ee531c13d238d757742387d1928de822d959e997  $f" | sha256sum -c -; \
  tar -xJf "$f" -C /usr/local --strip-components=1; \
  rm -f "$f"; \
  node --version; \
  npm install -g --no-fund --no-audit pnpm@12.16.1; \
  pnpm --version
# run.ts writes this into environment.json, so every result names its image.
ENV PLANT_BENCH_IMAGE="mcr.microsoft.com/playwright:v1.65.0-noble, Node 26.13.0, pnpm 12.16.1"
WORKDIR /work
