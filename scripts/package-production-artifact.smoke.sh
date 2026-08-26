#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd "${script_dir}/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf -- "${work}"' EXIT

revision=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
other_revision=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
required_artifact_paths=(
  server.js
  migrate-production.cjs
  collaboration-server.cjs
  REVISION
  migrations/meta/_journal.json
  deploy/systemd/knowmesh-collaboration.service
  deploy/nginx/knowmesh-websocket-map.conf
  deploy/nginx/knowmesh-collaboration-location.conf
  deploy/scripts/activate-release.sh
  deploy/scripts/rollback-release.sh
)

fail_test() {
  echo "Smoke test failed: $1" >&2
  exit 1
}

create_standalone_fixture() {
  local standalone=$1
  mkdir -p "${standalone}/nested/runtime"
  printf 'placeholder server entry\n' > "${standalone}/server.js"
  printf 'SECRET_SHOULD_NOT_SHIP=1\n' > "${standalone}/.env.local"
  printf 'NESTED_SECRET_SHOULD_NOT_SHIP=1\n' > "${standalone}/nested/runtime/.env.production"
}

create_static_fixture() {
  mkdir -p "${work}/static"
  printf 'body { color: inherit; }\n' > "${work}/static/app.css"
}

package() {
  local standalone=$1 output=$2 requested_revision=$3
  bash "${script_dir}/package-production-artifact.sh" \
    --repository-root "${repository_root}" \
    --standalone-dir "${standalone}" \
    --static-dir "${work}/static" \
    --output "${output}" \
    --revision "${requested_revision}"
}

expect_failure() {
  local description=$1
  shift
  if "$@" >"${work}/last-failure.log" 2>&1; then
    cat "${work}/last-failure.log" >&2
    fail_test "${description}: command unexpectedly succeeded"
  fi
}

assert_archive_matches_manifest() {
  local archive=$1 manifest=$2
  tar -tzf "${archive}" | sed 's|^\./||' | grep -v -e '/$' -e '^$' | LC_ALL=C sort > "${work}/archive-listing.txt"
  diff -u "${manifest}" "${work}/archive-listing.txt" || fail_test "manifest does not match archive contents of ${archive}"
}

assert_archive_is_complete_and_clean() {
  local archive=$1 expected_revision=$2
  local extracted="${work}/extracted-check"
  rm -rf -- "${extracted}"
  mkdir -p "${extracted}"
  tar -xzf "${archive}" -C "${extracted}"

  local relative_path
  for relative_path in "${required_artifact_paths[@]}"; do
    if [[ ! -e "${extracted}/${relative_path}" ]]; then
      fail_test "archive ${archive} is missing ${relative_path}"
    fi
  done

  if [[ "$(tr -d '[:space:]' < "${extracted}/REVISION")" != "${expected_revision}" ]]; then
    fail_test "archive ${archive} carries the wrong REVISION"
  fi

  if grep -Eq '(^|/)\.env' <(tar -tzf "${archive}"); then
    fail_test "archive ${archive} contains environment files"
  fi
}

create_static_fixture

standalone="${work}/standalone"
create_standalone_fixture "${standalone}"
manifest="${work}/manifest.txt"
if ! package "${standalone}" "${work}/release.tgz" "${revision}" > "${manifest}"; then
  fail_test "packaging a complete fixture"
fi
if [[ -e "${standalone}/.env.local" ]]; then
  fail_test "packaging left .env.local inside the standalone directory"
fi
if [[ -e "${standalone}/nested/runtime/.env.production" ]]; then
  fail_test "packaging left a nested environment file inside the standalone directory"
fi
assert_archive_matches_manifest "${work}/release.tgz" "${manifest}"
assert_archive_is_complete_and_clean "${work}/release.tgz" "${revision}"

stale_standalone="${work}/stale-standalone"
mkdir -p "${stale_standalone}"
printf '%s\n' "${other_revision}" > "${stale_standalone}/REVISION"
expect_failure "packaging refuses a standalone directory built from a different revision" \
  package "${stale_standalone}" "${work}/stale.tgz" "${revision}"

short_revision_standalone="${work}/short-revision-standalone"
create_standalone_fixture "${short_revision_standalone}"
expect_failure "packaging rejects revisions that are not full Git SHAs" \
  package "${short_revision_standalone}" "${work}/short-revision.tgz" "deadbeef"

missing_entry_standalone="${work}/missing-entry-standalone"
mkdir -p "${missing_entry_standalone}"
expect_failure "packaging fails when server.js is missing" \
  package "${missing_entry_standalone}" "${work}/missing-entry.tgz" "${revision}"

expect_failure "packaging rejects unknown arguments" \
  bash "${script_dir}/package-production-artifact.sh" --unknown

expect_failure "packaging rejects options without values" \
  bash "${script_dir}/package-production-artifact.sh" --output

echo "Packaging smoke tests passed."
