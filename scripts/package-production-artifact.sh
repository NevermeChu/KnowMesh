#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --repository-root <dir> --standalone-dir <dir> --static-dir <dir> --output <file> --revision <40-hex-git-sha>" >&2
}

fail() {
  echo "$1" >&2
  exit 1
}

require_file() {
  if [[ ! -f "$1" ]]; then
    fail "Artifact is missing required file: $1"
  fi
}

require_directory() {
  if [[ ! -d "$1" ]]; then
    fail "Artifact is missing required directory: $1"
  fi
}

repository_root=""
standalone_dir=""
static_dir=""
output=""
revision=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repository-root)
      [[ $# -ge 2 ]] || fail "--repository-root requires a value"
      repository_root=$2
      shift 2
      ;;
    --standalone-dir)
      [[ $# -ge 2 ]] || fail "--standalone-dir requires a value"
      standalone_dir=$2
      shift 2
      ;;
    --static-dir)
      [[ $# -ge 2 ]] || fail "--static-dir requires a value"
      static_dir=$2
      shift 2
      ;;
    --output)
      [[ $# -ge 2 ]] || fail "--output requires a value"
      output=$2
      shift 2
      ;;
    --revision)
      [[ $# -ge 2 ]] || fail "--revision requires a value"
      revision=$2
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

[[ -n "${repository_root}" ]] || fail "--repository-root is required"
[[ -n "${standalone_dir}" ]] || fail "--standalone-dir is required"
[[ -n "${static_dir}" ]] || fail "--static-dir is required"
[[ -n "${output}" ]] || fail "--output is required"
[[ -n "${revision}" ]] || fail "--revision is required"

if [[ ! "${revision}" =~ ^[0-9a-f]{40}$ ]]; then
  fail "--revision must be a full 40-character hexadecimal Git SHA"
fi

[[ -d "${repository_root}" ]] || fail "Repository root does not exist: ${repository_root}"
[[ -d "${standalone_dir}" ]] || fail "Standalone directory does not exist (run the Next.js build first): ${standalone_dir}"
[[ -d "${static_dir}" ]] || fail "Next.js static directory does not exist: ${static_dir}"

repository_root=$(cd "${repository_root}" && pwd)
standalone_dir=$(cd "${standalone_dir}" && pwd)
static_dir=$(cd "${static_dir}" && pwd)
mkdir -p "$(dirname "${output}")"
output=$(cd "$(dirname "${output}")" && pwd)/$(basename "${output}")

if [[ -f "${standalone_dir}/REVISION" ]]; then
  existing_revision=$(tr -d '[:space:]' < "${standalone_dir}/REVISION")
  if [[ "${existing_revision}" != "${revision}" ]]; then
    fail "Standalone directory was built from revision ${existing_revision}; refusing to package it as ${revision}"
  fi
fi

(
  cd "${repository_root}"
  npx --no-install esbuild scripts/migrate-production.ts \
    --bundle \
    --platform=node \
    --target=node24 \
    --format=cjs \
    --outfile="${standalone_dir}/migrate-production.cjs"
  npx --no-install esbuild scripts/collaboration-server.ts \
    --bundle \
    --platform=node \
    --target=node24 \
    --format=cjs \
    --define:import.meta.url=import_meta_url \
    --banner:js="const import_meta_url = require('node:url').pathToFileURL(__filename).href;" \
    --outfile="${standalone_dir}/collaboration-server.cjs"
)

mkdir -p "${standalone_dir}/public" "${standalone_dir}/.next/static" "${standalone_dir}/migrations" "${standalone_dir}/deploy"
cp -r "${repository_root}/public/." "${standalone_dir}/public/"
cp -r "${static_dir}/." "${standalone_dir}/.next/static/"
cp -r "${repository_root}/migrations/." "${standalone_dir}/migrations/"
cp -r "${repository_root}/deploy/." "${standalone_dir}/deploy/"
printf '%s\n' "${revision}" > "${standalone_dir}/REVISION"
find "${standalone_dir}" -type f -name '.env*' -delete

require_file "${standalone_dir}/server.js"
require_file "${standalone_dir}/migrate-production.cjs"
require_file "${standalone_dir}/collaboration-server.cjs"
require_directory "${standalone_dir}/.next/static"
require_directory "${standalone_dir}/public"
require_file "${standalone_dir}/migrations/meta/_journal.json"
require_file "${standalone_dir}/deploy/systemd/knowmesh-collaboration.service"
require_file "${standalone_dir}/deploy/nginx/knowmesh-websocket-map.conf"
require_file "${standalone_dir}/deploy/nginx/knowmesh-collaboration-location.conf"
require_file "${standalone_dir}/deploy/scripts/activate-release.sh"
require_file "${standalone_dir}/deploy/scripts/rollback-release.sh"

packaged_revision=$(tr -d '[:space:]' < "${standalone_dir}/REVISION")
[[ "${packaged_revision}" == "${revision}" ]] || fail "REVISION file does not match the requested revision"

while IFS= read -r -d '' leftover_env_file; do
  fail "Artifact must not contain environment files: ${leftover_env_file}"
done < <(find "${standalone_dir}" -name '.env*' -print0)

tar -C "${standalone_dir}" -czf "${output}" .

(cd "${standalone_dir}" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)

echo "Packaged ${output} from ${standalone_dir} at revision ${revision}" >&2
