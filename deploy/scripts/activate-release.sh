#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <release-id> <release-root> <current-link> <environment-file> <node-binary> <service-name> <collaboration-service-name> <collaboration-health-url> <collaboration-deploy-enabled> [deploy-user]" >&2
}

fail() {
  echo "$1" >&2
  exit 1
}

require_absolute_path() {
  local label=$1 value=$2
  if [[ "${value}" != /* ]]; then
    fail "${label} must be an absolute server path: ${value}"
  fi
}

release_id=${1:-}
release_root=${2:-}
current_link=${3:-}
environment_file=${4:-}
node_binary=${5:-}
service_name=${6:-}
collaboration_service_name=${7:-}
collaboration_health_url=${8:-}
collaboration_deploy_enabled=${9:-}
deploy_user=${10:-thisme}

[[ -n "${release_id}" && -n "${release_root}" && -n "${current_link}" && -n "${environment_file}" ]] || { usage; exit 1; }
[[ -n "${node_binary}" && -n "${service_name}" && -n "${collaboration_service_name}" ]] || { usage; exit 1; }
[[ -n "${collaboration_health_url}" && -n "${collaboration_deploy_enabled}" ]] || { usage; exit 1; }

if [[ ! "${release_id}" =~ ^[0-9a-f]{40}$ ]]; then
  fail 'Invalid release ID'
fi

require_absolute_path 'Release root' "${release_root}"
require_absolute_path 'Current link' "${current_link}"
require_absolute_path 'Environment file' "${environment_file}"
require_absolute_path 'Node binary' "${node_binary}"

archive="/tmp/knowmesh-release-${release_id}.tgz"
release_dir="${release_root}/${release_id}"
staging_dir="${release_root}/.${release_id}.staging"
rollback_marker="${release_root}/.previous-${release_id}"
temporary_link="${current_link}.next-${release_id}"

for derived_path in "${release_dir}" "${staging_dir}" "${rollback_marker}"; do
  case "${derived_path}" in
    "${release_root}"/*) ;;
    *) fail "Derived path escapes the release root: ${derived_path}" ;;
  esac
done

cleanup() {
  rm -f -- "${archive}" "${temporary_link}"
  if [[ -d "${staging_dir}" ]]; then
    rm -rf -- "${staging_dir}"
  fi
}
trap cleanup EXIT

install -d -o "${deploy_user}" -g "${deploy_user}" "${release_root}"
test -f "${archive}"

if [[ ! -d "${release_dir}" ]]; then
  rm -rf -- "${staging_dir}"
  install -d -o "${deploy_user}" -g "${deploy_user}" "${staging_dir}"
  tar -xzf "${archive}" -C "${staging_dir}"
  test -f "${staging_dir}/server.js"
  test -f "${staging_dir}/migrate-production.cjs"
  test -f "${staging_dir}/collaboration-server.cjs"
  test -d "${staging_dir}/.next/static"
  test -d "${staging_dir}/public"
  test -f "${staging_dir}/migrations/meta/_journal.json"
  test -f "${staging_dir}/deploy/systemd/knowmesh-collaboration.service"
  test -f "${staging_dir}/deploy/nginx/knowmesh-websocket-map.conf"
  test -f "${staging_dir}/deploy/nginx/knowmesh-collaboration-location.conf"
  test "$(cat "${staging_dir}/REVISION")" = "${release_id}"
  chown -R "${deploy_user}:${deploy_user}" "${staging_dir}"
  mv -- "${staging_dir}" "${release_dir}"
fi

test -f "${release_dir}/server.js"
test -f "${release_dir}/migrate-production.cjs"
test -f "${release_dir}/collaboration-server.cjs"
test -d "${release_dir}/.next/static"
test -d "${release_dir}/public"
test -f "${release_dir}/migrations/meta/_journal.json"
test -f "${release_dir}/deploy/systemd/knowmesh-collaboration.service"
test -f "${release_dir}/deploy/nginx/knowmesh-websocket-map.conf"
test -f "${release_dir}/deploy/nginx/knowmesh-collaboration-location.conf"
test "$(cat "${release_dir}/REVISION")" = "${release_id}"
test -r "${environment_file}"
test -x "${node_binary}"

if [[ "${collaboration_deploy_enabled}" != true && "${collaboration_deploy_enabled}" != false ]]; then
  fail 'Invalid production collaboration deployment flag'
fi

environment_collaboration_enabled=false
if grep -Eq '^[[:space:]]*COLLABORATION_ENABLED[[:space:]]*=[[:space:]]*true[[:space:]]*$' "${environment_file}" || \
  grep -Eq '^[[:space:]]*COLLABORATION_ENABLED[[:space:]]*=[[:space:]]*"true"[[:space:]]*$' "${environment_file}" || \
  grep -Eq "^[[:space:]]*COLLABORATION_ENABLED[[:space:]]*=[[:space:]]*'true'[[:space:]]*$" "${environment_file}"; then
  environment_collaboration_enabled=true
fi
if [[ "${environment_collaboration_enabled}" != "${collaboration_deploy_enabled}" ]]; then
  fail 'GitHub and server collaboration flags do not match'
fi
if [[ "${collaboration_deploy_enabled}" == true ]]; then
  systemctl cat "${collaboration_service_name}" >/dev/null
fi

"${node_binary}" "${release_dir}/migrate-production.cjs" "${environment_file}"

old_release=$(readlink -f "${current_link}")
if [[ -z "${old_release}" || ! -d "${old_release}" ]]; then
  fail 'Current production release is unavailable for rollback'
fi
case "${old_release}" in
  "${release_root}"/*) ;;
  *) fail "Rollback target is outside the release root: ${old_release}" ;;
esac
printf '%s\n' "${old_release}" > "${rollback_marker}"

rm -f -- "${temporary_link}"
ln -s "${release_dir}" "${temporary_link}"
mv -Tf -- "${temporary_link}" "${current_link}"

collaboration_healthy=true
if [[ "${collaboration_deploy_enabled}" == true ]]; then
  collaboration_healthy=false
  if systemctl restart "${collaboration_service_name}"; then
    for attempt in $(seq 1 30); do
      if curl --fail --silent --show-error "${collaboration_health_url}" >/dev/null; then
        collaboration_healthy=true
        break
      fi
      sleep 2
    done
  fi
fi

application_healthy=false
if [[ "${collaboration_healthy}" == true ]] && systemctl restart "${service_name}"; then
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null; then
      application_healthy=true
      break
    fi
    sleep 2
  done
fi

if [[ "${collaboration_healthy}" != true || "${application_healthy}" != true ]]; then
  rollback_link="${current_link}.rollback-${release_id}"
  rm -f -- "${rollback_link}"
  ln -s "${old_release}" "${rollback_link}"
  mv -Tf -- "${rollback_link}" "${current_link}"
  if [[ "${collaboration_deploy_enabled}" == true ]]; then
    systemctl restart "${collaboration_service_name}" || true
  fi
  systemctl restart "${service_name}" || true
  rm -f -- "${rollback_marker}"
  echo 'Local production health check failed; application and collaboration releases were rolled back' >&2
  exit 1
fi
