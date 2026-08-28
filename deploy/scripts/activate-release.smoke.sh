#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
work=$(mktemp -d)
archives=()

cleanup() {
  local archive
  for archive in "${archives[@]}"; do
    rm -f -- "${archive}"
  done
  rm -rf -- "${work}"
}
trap cleanup EXIT

fail_test() {
  echo "Smoke test failed: $1" >&2
  exit 1
}

stub_bin="${work}/bin"
mkdir -p "${stub_bin}"

cat > "${stub_bin}/systemctl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${SYSTEMCTL_LOG:?}"
case "${1:-}" in
  cat)
    exit 0
    ;;
  restart)
    local_unit=${2:-}
    case "${local_unit}" in
      *collaboration*)
        [[ -z "${COLLABORATION_RESTART_FAIL_FILE:-}" || ! -e "${COLLABORATION_RESTART_FAIL_FILE}" ]]
        ;;
      *)
        [[ -z "${APP_RESTART_FAIL_FILE:-}" || ! -e "${APP_RESTART_FAIL_FILE}" ]]
        ;;
    esac
    ;;
  *)
    exit 0
    ;;
esac
STUB

cat > "${stub_bin}/curl" <<'STUB'
#!/usr/bin/env bash
if [[ -n "${HEALTH_FAIL_FILE:-}" && -e "${HEALTH_FAIL_FILE}" ]]; then
  exit 22
fi
exit 0
STUB

cat > "${stub_bin}/fake-node" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${NODE_LOG:?}"
if [[ -n "${MIGRATE_FAIL_FILE:-}" && -e "${MIGRATE_FAIL_FILE}" ]]; then
  echo 'Simulated production migration failure' >&2
  exit 1
fi
exit 0
STUB

cat > "${stub_bin}/sleep" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB

chmod +x "${stub_bin}/systemctl" "${stub_bin}/curl" "${stub_bin}/fake-node" "${stub_bin}/sleep"

random_sha() {
  printf '%s' "$$-${RANDOM}-${RANDOM}-${RANDOM}-${1:-seed}" | sha1sum | cut -c1-40
}

new_sandbox() {
  local sandbox=$1
  mkdir -p "${sandbox}/srv/knowmesh-app/releases/old"
  printf 'old server entry\n' > "${sandbox}/srv/knowmesh-app/releases/old/server.js"
  ln -s "${sandbox}/srv/knowmesh-app/releases/old" "${sandbox}/srv/knowmesh-app/current"
}

write_env_file() {
  local sandbox=$1 value=$2
  printf 'COLLABORATION_ENABLED=%s\n' "${value}" > "${sandbox}/knowmesh.env"
}

build_archive() {
  local release_id=$1 correct_revision=$2
  local payload="${work}/payload-${release_id}"
  mkdir -p "${payload}/.next/static" "${payload}/public" "${payload}/migrations/meta" \
    "${payload}/deploy/systemd" "${payload}/deploy/nginx"
  printf 'server\n' > "${payload}/server.js"
  printf 'migrate\n' > "${payload}/migrate-production.cjs"
  printf 'collaboration\n' > "${payload}/collaboration-server.cjs"
  printf 'whiteboard-collaboration\n' > "${payload}/whiteboard-collaboration-server.cjs"
  printf '{}\n' > "${payload}/migrations/meta/_journal.json"
  printf 'unit\n' > "${payload}/deploy/systemd/knowmesh-collaboration.service"
  printf 'whiteboard-unit\n' > "${payload}/deploy/systemd/knowmesh-whiteboard-collaboration.service"
  printf 'map\n' > "${payload}/deploy/nginx/knowmesh-websocket-map.conf"
  printf 'location\n' > "${payload}/deploy/nginx/knowmesh-collaboration-location.conf"
  printf 'whiteboard-location\n' > "${payload}/deploy/nginx/knowmesh-whiteboard-collaboration-location.conf"
  if [[ "${correct_revision}" == yes ]]; then
    printf '%s\n' "${release_id}" > "${payload}/REVISION"
  else
    printf '%s\n' "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" > "${payload}/REVISION"
  fi
  local archive="/tmp/knowmesh-release-${release_id}.tgz"
  tar -C "${payload}" -czf "${archive}" .
  archives+=("${archive}")
}

run_activate() {
  local sandbox=$1 release_id=$2 enabled=$3
  env \
    PATH="${stub_bin}:${PATH}" \
    SYSTEMCTL_LOG="${sandbox}/systemctl.log" \
    NODE_LOG="${sandbox}/node.log" \
    HEALTH_FAIL_FILE="${sandbox}/health-fail" \
    MIGRATE_FAIL_FILE="${sandbox}/migrate-fail" \
    COLLABORATION_RESTART_FAIL_FILE="${sandbox}/collab-restart-fail" \
    APP_RESTART_FAIL_FILE="${sandbox}/app-restart-fail" \
    bash "${script_dir}/activate-release.sh" \
    "${release_id}" \
    "${sandbox}/srv/knowmesh-app/releases" \
    "${sandbox}/srv/knowmesh-app/current" \
    "${sandbox}/knowmesh.env" \
    "${stub_bin}/fake-node" \
    knowmesh.service \
    knowmesh-collaboration.service \
    http://127.0.0.1:1235/ready \
    "${enabled}" \
    "$(id -un)"
}

run_rollback() {
  local sandbox=$1 release_id=$2
  env \
    PATH="${stub_bin}:${PATH}" \
    SYSTEMCTL_LOG="${sandbox}/systemctl.log" \
    bash "${script_dir}/rollback-release.sh" \
    "${release_id}" \
    "${sandbox}/srv/knowmesh-app/releases" \
    "${sandbox}/srv/knowmesh-app/current" \
    knowmesh.service \
    knowmesh-collaboration.service \
    true
}

expect_failure() {
  local description=$1 expected_message=$2
  shift 2
  if "$@" >"${work}/last-failure.log" 2>&1; then
    cat "${work}/last-failure.log" >&2
    fail_test "${description}: command unexpectedly succeeded"
  fi
  if [[ -n "${expected_message}" ]] && ! grep -q "${expected_message}" "${work}/last-failure.log"; then
    cat "${work}/last-failure.log" >&2
    fail_test "${description}: failure lacked the expected message"
  fi
}

assert_restarts_order() {
  local log=$1 expected_first=$2 expected_second=$3
  local restart_log="${work}/restart-lines.log"
  grep '^restart ' "${log}" > "${restart_log}"
  if [[ "$(wc -l < "${restart_log}")" -ne 2 ]]; then
    fail_test "expected exactly 2 service restarts in ${log}, found $(wc -l < "${restart_log}")"
  fi
  if [[ "$(sed -n '1p' "${restart_log}")" != "restart ${expected_first}" ]]; then
    fail_test "first restart must be ${expected_first}, got: $(sed -n '1p' "${restart_log}")"
  fi
  if [[ "$(sed -n '2p' "${restart_log}")" != "restart ${expected_second}" ]]; then
    fail_test "second restart must be ${expected_second}, got: $(sed -n '2p' "${restart_log}")"
  fi
}

happy_sha=$(random_sha happy)
happy="${work}/happy"
new_sandbox "${happy}"
write_env_file "${happy}" true
build_archive "${happy_sha}" yes
run_activate "${happy}" "${happy_sha}" true
if [[ "$(readlink -f "${happy}/srv/knowmesh-app/current")" != "${happy}/srv/knowmesh-app/releases/${happy_sha}" ]]; then
  fail_test "activation did not point current at the new release"
fi
if [[ "$(cat "${happy}/srv/knowmesh-app/releases/.previous-${happy_sha}")" != "${happy}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "rollback marker does not record the previous release"
fi
if [[ -e "/tmp/knowmesh-release-${happy_sha}.tgz" ]]; then
  fail_test "activation left the uploaded archive behind"
fi
if compgen -G "${happy}/srv/knowmesh-app/releases/*staging*" >/dev/null; then
  fail_test "activation left a staging directory behind"
fi
if [[ -e "${happy}/srv/knowmesh-app/current.next-${happy_sha}" ]]; then
  fail_test "activation left the temporary link behind"
fi
assert_restarts_order "${happy}/systemctl.log" knowmesh-collaboration.service knowmesh.service
if ! grep -q "migrate-production.cjs ${happy}/knowmesh.env" "${happy}/node.log"; then
  fail_test "migration did not run against the environment file"
fi

disabled_sha=$(random_sha disabled)
disabled="${work}/disabled"
new_sandbox "${disabled}"
write_env_file "${disabled}" false
build_archive "${disabled_sha}" yes
run_activate "${disabled}" "${disabled_sha}" false
if [[ "$(readlink -f "${disabled}/srv/knowmesh-app/current")" != "${disabled}/srv/knowmesh-app/releases/${disabled_sha}" ]]; then
  fail_test "activation without collaboration did not point current at the new release"
fi
if grep -q collaboration "${disabled}/systemctl.log"; then
  fail_test "collaboration service was restarted while deployment was disabled"
fi

mismatched="${work}/mismatched"
mismatched_sha=$(random_sha mismatch)
new_sandbox "${mismatched}"
write_env_file "${mismatched}" false
build_archive "${mismatched_sha}" yes
expect_failure "activation rejects mismatched collaboration flags" "flags do not match" \
  run_activate "${mismatched}" "${mismatched_sha}" true
if [[ "$(readlink -f "${mismatched}/srv/knowmesh-app/current")" != "${mismatched}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "rejected activation changed the current link"
fi

migration_failed_sha=$(random_sha migration)
migration_failed="${work}/migration-failed"
new_sandbox "${migration_failed}"
write_env_file "${migration_failed}" true
build_archive "${migration_failed_sha}" yes
touch "${migration_failed}/migrate-fail"
expect_failure "activation stops when the migration fails" "Simulated production migration failure" \
  run_activate "${migration_failed}" "${migration_failed_sha}" true
if [[ "$(readlink -f "${migration_failed}/srv/knowmesh-app/current")" != "${migration_failed}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "failed migration changed the current link"
fi
if [[ -e "${migration_failed}/srv/knowmesh-app/releases/.previous-${migration_failed_sha}" ]]; then
  fail_test "failed migration wrote a rollback marker"
fi
if grep -q '^restart ' "${migration_failed}/systemctl.log" 2>/dev/null; then
  fail_test "services were restarted even though the migration failed"
fi

missing_current_sha=$(random_sha missing-current)
missing_current="${work}/missing-current"
new_sandbox "${missing_current}"
write_env_file "${missing_current}" true
build_archive "${missing_current_sha}" yes
rm -f -- "${missing_current}/srv/knowmesh-app/current"
expect_failure "activation validates rollback availability before migration" "Current production release is unavailable for rollback" \
  run_activate "${missing_current}" "${missing_current_sha}" true
if [[ -s "${missing_current}/node.log" ]]; then
  fail_test "migration ran without an available rollback release"
fi
if [[ -e "${missing_current}/srv/knowmesh-app/releases/.previous-${missing_current_sha}" ]]; then
  fail_test "activation without a rollback release wrote a rollback marker"
fi

health_failed_sha=$(random_sha health)
health_failed="${work}/health-failed"
new_sandbox "${health_failed}"
write_env_file "${health_failed}" true
build_archive "${health_failed_sha}" yes
touch "${health_failed}/health-fail"
expect_failure "activation rolls back when the health check keeps failing" "were rolled back" \
  run_activate "${health_failed}" "${health_failed_sha}" true
if [[ "$(readlink -f "${health_failed}/srv/knowmesh-app/current")" != "${health_failed}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "failed health check did not restore the previous release"
fi
if [[ -e "${health_failed}/srv/knowmesh-app/releases/.previous-${health_failed_sha}" ]]; then
  fail_test "rolled-back activation kept its rollback marker"
fi
if ! grep -q '^restart knowmesh.service$' "${health_failed}/systemctl.log"; then
  fail_test "rollback did not restart the application service"
fi

wrong_revision_sha=$(random_sha revision)
wrong_revision="${work}/wrong-revision"
new_sandbox "${wrong_revision}"
write_env_file "${wrong_revision}" true
build_archive "${wrong_revision_sha}" no
expect_failure "activation rejects an artifact whose REVISION does not match" "" \
  run_activate "${wrong_revision}" "${wrong_revision_sha}" true
if [[ -d "${wrong_revision}/srv/knowmesh-app/releases/${wrong_revision_sha}" ]]; then
  fail_test "artifact with a wrong REVISION was promoted to a release directory"
fi

invalid_id="${work}/invalid-id"
new_sandbox "${invalid_id}"
write_env_file "${invalid_id}" true
expect_failure "activation rejects an invalid release ID" "Invalid release ID" \
  run_activate "${invalid_id}" "not-a-sha" true
if [[ "$(ls -A "${invalid_id}/srv/knowmesh-app/releases")" != "old" ]]; then
  fail_test "invalid release ID modified the release root"
fi

missing_args="${work}/missing-args"
new_sandbox "${missing_args}"
expect_failure "activation requires every positional argument" "Usage:" \
  run_activate "${missing_args}" "$(random_sha missing)" ""

rollback_sha=$(random_sha rollback)
rollback_sandbox="${work}/rollback"
new_sandbox "${rollback_sandbox}"
ln -s "${rollback_sandbox}/srv/knowmesh-app/releases/${rollback_sha}" "${rollback_sandbox}/srv/knowmesh-app/current"
printf '%s\n' "${rollback_sandbox}/srv/knowmesh-app/releases/old" > "${rollback_sandbox}/srv/knowmesh-app/releases/.previous-${rollback_sha}"
run_rollback "${rollback_sandbox}" "${rollback_sha}"
if [[ "$(readlink -f "${rollback_sandbox}/srv/knowmesh-app/current")" != "${rollback_sandbox}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "rollback did not restore the previous release"
fi
if [[ -e "${rollback_sandbox}/srv/knowmesh-app/releases/.previous-${rollback_sha}" ]]; then
  fail_test "rollback kept its marker file"
fi

outside_root="${work}/outside-root"
new_sandbox "${outside_root}"
outside_target="${work}/outside-target"
mkdir -p "${outside_target}"
printf '%s\n' "${outside_target}" > "${outside_root}/srv/knowmesh-app/releases/.previous-deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
expect_failure "rollback refuses targets outside the release root" "Rollback target is invalid" \
  run_rollback "${outside_root}" "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
if [[ "$(readlink -f "${outside_root}/srv/knowmesh-app/current")" != "${outside_root}/srv/knowmesh-app/releases/old" ]]; then
  fail_test "rejected rollback changed the current link"
fi

echo "Activation and rollback smoke tests passed."
