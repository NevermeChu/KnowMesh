#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <release-id> <release-root> <current-link> <service-name> <collaboration-service-name> <collaboration-deploy-enabled>" >&2
}

release_id=${1:-}
release_root=${2:-}
current_link=${3:-}
service_name=${4:-}
collaboration_service_name=${5:-}
collaboration_deploy_enabled=${6:-}

[[ -n "${release_id}" && -n "${release_root}" && -n "${current_link}" ]] || { usage; exit 1; }
[[ -n "${service_name}" && -n "${collaboration_service_name}" && -n "${collaboration_deploy_enabled}" ]] || { usage; exit 1; }

if [[ ! "${release_id}" =~ ^[0-9a-f]{40}$ ]]; then
  exit 1
fi

rollback_marker="${release_root}/.previous-${release_id}"
old_release=$(cat "${rollback_marker}")
if [[ "${old_release}" != "${release_root}"/* || ! -d "${old_release}" ]]; then
  echo 'Rollback target is invalid' >&2
  exit 1
fi

rollback_link="${current_link}.rollback-${release_id}"
rm -f -- "${rollback_link}"
ln -s "${old_release}" "${rollback_link}"
mv -Tf -- "${rollback_link}" "${current_link}"
if [[ "${collaboration_deploy_enabled}" == true ]]; then
  systemctl restart "${collaboration_service_name}" || true
fi
systemctl restart "${service_name}" || true
rm -f -- "${rollback_marker}"
