#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <release-id> <release-root> <current-link> <environment-file> <node-binary> <service-name> <collaboration-service-name> <collaboration-health-url> <collaboration-deploy-enabled> [deploy-user] [whiteboard-collaboration-service-name] [whiteboard-collaboration-health-url] [whiteboard-collaboration-deploy-enabled]" >&2
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
whiteboard_collaboration_service_name=${11:-knowmesh-whiteboard-collaboration.service}
whiteboard_collaboration_health_url=${12:-http://127.0.0.1:1245/ready}
whiteboard_collaboration_deploy_enabled=${13:-false}

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
  test -f "${staging_dir}/whiteboard-collaboration-server.cjs"
  test -d "${staging_dir}/.next/static"
  test -d "${staging_dir}/public"
  test -f "${staging_dir}/migrations/meta/_journal.json"
  test -f "${staging_dir}/deploy/systemd/knowmesh-collaboration.service"
  test -f "${staging_dir}/deploy/systemd/knowmesh-whiteboard-collaboration.service"
  test -f "${staging_dir}/deploy/nginx/knowmesh-websocket-map.conf"
  test -f "${staging_dir}/deploy/nginx/knowmesh-collaboration-location.conf"
  test -f "${staging_dir}/deploy/nginx/knowmesh-whiteboard-collaboration-location.conf"
  test "$(cat "${staging_dir}/REVISION")" = "${release_id}"
  chown -R "${deploy_user}:${deploy_user}" "${staging_dir}"
  mv -- "${staging_dir}" "${release_dir}"
fi

test -f "${release_dir}/server.js"
test -f "${release_dir}/migrate-production.cjs"
test -f "${release_dir}/collaboration-server.cjs"
test -f "${release_dir}/whiteboard-collaboration-server.cjs"
test -d "${release_dir}/.next/static"
test -d "${release_dir}/public"
test -f "${release_dir}/migrations/meta/_journal.json"
test -f "${release_dir}/deploy/systemd/knowmesh-collaboration.service"
test -f "${release_dir}/deploy/systemd/knowmesh-whiteboard-collaboration.service"
test -f "${release_dir}/deploy/nginx/knowmesh-websocket-map.conf"
test -f "${release_dir}/deploy/nginx/knowmesh-collaboration-location.conf"
test -f "${release_dir}/deploy/nginx/knowmesh-whiteboard-collaboration-location.conf"
test "$(cat "${release_dir}/REVISION")" = "${release_id}"
test -r "${environment_file}"
test -x "${node_binary}"

if [[ "${collaboration_deploy_enabled}" != true && "${collaboration_deploy_enabled}" != false ]]; then
  fail 'Invalid production collaboration deployment flag'
fi
if [[ "${whiteboard_collaboration_deploy_enabled}" != true && "${whiteboard_collaboration_deploy_enabled}" != false ]]; then
  fail 'Invalid production whiteboard collaboration deployment flag'
fi

environment_flag_enabled() {
  local name=$1
  grep -Eq "^[[:space:]]*${name}[[:space:]]*=[[:space:]]*true[[:space:]]*$" "${environment_file}" || \
    grep -Eq "^[[:space:]]*${name}[[:space:]]*=[[:space:]]*\"true\"[[:space:]]*$" "${environment_file}" || \
    grep -Eq "^[[:space:]]*${name}[[:space:]]*=[[:space:]]*'true'[[:space:]]*$" "${environment_file}"
}

environment_collaboration_enabled=false
if environment_flag_enabled COLLABORATION_ENABLED; then
  environment_collaboration_enabled=true
fi
if [[ "${environment_collaboration_enabled}" != "${collaboration_deploy_enabled}" ]]; then
  fail 'GitHub and server collaboration flags do not match'
fi
environment_whiteboard_collaboration_enabled=false
if environment_flag_enabled WHITEBOARD_COLLABORATION_ENABLED; then
  environment_whiteboard_collaboration_enabled=true
fi
if [[ "${environment_whiteboard_collaboration_enabled}" != "${whiteboard_collaboration_deploy_enabled}" ]]; then
  fail 'GitHub and server whiteboard collaboration flags do not match'
fi
if [[ "${collaboration_deploy_enabled}" == true ]]; then
  systemctl cat "${collaboration_service_name}" >/dev/null
fi
if [[ "${whiteboard_collaboration_deploy_enabled}" == true ]]; then
  systemctl cat "${whiteboard_collaboration_service_name}" >/dev/null
fi

old_release=$(readlink -f "${current_link}" || true)
if [[ -z "${old_release}" || ! -d "${old_release}" ]]; then
  fail 'Current production release is unavailable for rollback'
fi
case "${old_release}" in
  "${release_root}"/*) ;;
  *) fail "Rollback target is outside the release root: ${old_release}" ;;
esac

"${node_binary}" "${release_dir}/migrate-production.cjs" "${environment_file}"

printf '%s\n' "${old_release}" > "${rollback_marker}"

rm -f -- "${temporary_link}"
ln -s "${release_dir}" "${temporary_link}"
mv -Tf -- "${temporary_link}" "${current_link}"

wait_for_health() {
  local url=$1
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error "${url}" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restart_sidecar_services() {
  if [[ "${collaboration_deploy_enabled}" == true ]]; then
    systemctl restart "${collaboration_service_name}" || true
  fi
  if [[ "${whiteboard_collaboration_deploy_enabled}" == true ]]; then
    systemctl restart "${whiteboard_collaboration_service_name}" || true
  fi
}

collaboration_healthy=true
if [[ "${collaboration_deploy_enabled}" == true ]]; then
  collaboration_healthy=false
  if systemctl restart "${collaboration_service_name}"; then
    if wait_for_health "${collaboration_health_url}"; then
      collaboration_healthy=true
    fi
  fi
fi

whiteboard_collaboration_healthy=true
if [[ "${whiteboard_collaboration_deploy_enabled}" == true ]]; then
  whiteboard_collaboration_healthy=false
  if systemctl restart "${whiteboard_collaboration_service_name}"; then
    if wait_for_health "${whiteboard_collaboration_health_url}"; then
      whiteboard_collaboration_healthy=true
    fi
  fi
fi

application_healthy=false
if [[ "${collaboration_healthy}" == true && "${whiteboard_collaboration_healthy}" == true ]] && systemctl restart "${service_name}"; then
  if wait_for_health http://127.0.0.1:3000/; then
    application_healthy=true
  fi
fi

if [[ "${collaboration_healthy}" != true || "${whiteboard_collaboration_healthy}" != true || "${application_healthy}" != true ]]; then
  rollback_link="${current_link}.rollback-${release_id}"
  rm -f -- "${rollback_link}"
  ln -s "${old_release}" "${rollback_link}"
  mv -Tf -- "${rollback_link}" "${current_link}"
  restart_sidecar_services
  systemctl restart "${service_name}" || true
  rm -f -- "${rollback_marker}"
  echo 'Local production health check failed; application and collaboration releases were rolled back' >&2
  exit 1
fi
