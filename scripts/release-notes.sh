#!/usr/bin/env bash
# Prints the release notes for an app tag (ADR 0004): the tag's section of the
# app's CHANGELOG.md, written by `changeset version`. When there's no section
# for that version, prints a link to the changelog instead, so a release is
# never blocked on its notes.
#
#   scripts/release-notes.sh plant-v0.2.1
set -euo pipefail

tag=$1
app=${tag%%-v*}
version=${tag#*-v}
case "$app" in
  plant | markets) dir=apps/dashboards/$app ;;
  basic | processor | site) dir=apps/$app ;;
  *) echo "unknown app in tag: $tag" >&2; exit 1 ;;
esac

changelog=$dir/CHANGELOG.md
url="https://github.com/isoloop/web/blob/$tag/$changelog"
notes=""
if [ -f "$changelog" ]; then
  # From "## <version>" up to the next "## " heading.
  notes=$(awk -v v="$version" '
    $0 == "## " v { on = 1; next }
    on && /^## / { exit }
    on { print }
  ' "$changelog" | sed -e '/./,$!d')
fi

if [ -n "$notes" ]; then
  printf '%s\n\nFull changelog: %s\n' "$notes" "$url"
else
  printf 'No changelog section for %s yet. The changelog: %s\n' "$version" "$url"
fi
