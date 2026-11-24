#!/usr/bin/env bash
# Runs js-bench on bench machine 1 (apps/bench/machines.md), quiet and at fixed
# clocks, under a CPU profile, from a clone of isoloop/web used only for bench
# runs.
#
#   apps/bench/js/scripts/server-run.sh <profile> calibrate           # writes calibration.json
#   apps/bench/js/scripts/server-run.sh <profile> [pnpm bench args]   # e.g. --quick --tier cheap
#
# Profiles (4 physical cores 2,4,6,8, as the M3 runs):
#   base      --cpuset-cpus=2,4,6,8               maxWorkers 4
#   two-core  --cpuset-cpus=2,4                   maxWorkers 2
#   quota     --cpuset-cpus=2,4,6,8 --cpus=1.5    maxWorkers 4
#
# `sudo -n bench-mode on` pauses the other containers and fixes every core at
# 2.0 GHz; the trap runs `bench-mode off` whatever happens. ~/bench/.lock keeps
# two bench runs from overlapping. Output: ~/bench/js-bench-<profile>.log.
# JSBENCH_MACHINE names the machine in run.json; a new machine gets the next
# number (apps/bench/machines.md).
set -u
# A closed SSH session sends SIGHUP: ignore it here, and keep docker from
# passing signals into the container (it did, on 2026-11-23, at run 107).
trap '' HUP
PROFILE="${1:?profile: base | two-core | quota}"
shift
case "$PROFILE" in
  base) FLAGS="--cpuset-cpus=2,4,6,8"; MAXW=4 ;;
  two-core) FLAGS="--cpuset-cpus=2,4"; MAXW=2 ;;
  quota) FLAGS="--cpuset-cpus=2,4,6,8 --cpus=1.5"; MAXW=4 ;;
  *) echo "unknown profile: $PROFILE" >&2; exit 2 ;;
esac
MACHINE=bench-machine-1
# The repo root: the container mounts the whole workspace, as pnpm needs it.
cd "$(dirname "$0")/../../../.."
LOG=~/bench/js-bench-$PROFILE.log
exec > >(tee -a "$LOG") 2>&1
echo "== start $(date -Is) profile $PROFILE on $MACHINE, $(git log --oneline -1)"
exec 9>~/bench/.lock
flock -n 9 || { echo "another bench run holds ~/bench/.lock"; exit 1; }
cleanup() { sudo -n bench-mode off; echo "== bench-mode off $(date -Is)"; }
trap cleanup EXIT
docker build -q -t js-bench apps/bench/js || exit 1
sudo -n bench-mode on
echo "== bench-mode on $(date -Is)"
if [ "${1:-}" = calibrate ]; then
  shift
  CMD="pnpm --filter js-bench calibrate $*"
else
  CMD="pnpm --filter js-bench bench --profile $PROFILE --max-workers $MAXW $*"
fi
mkdir -p apps/bench/js/.home
# shellcheck disable=SC2086
docker run --rm --init --sig-proxy=false $FLAGS --shm-size=2g \
  --user "$(id -u):$(id -g)" -e HOME=/work/apps/bench/js/.home \
  -e JSBENCH_PROFILE="$PROFILE" -e JSBENCH_MAX_WORKERS="$MAXW" -e JSBENCH_MACHINE="$MACHINE" \
  -v "$PWD":/work -w /work js-bench \
  bash -lc "pnpm install --frozen-lockfile --filter js-bench && $CMD"
echo "== docker exit $? $(date -Is)"
