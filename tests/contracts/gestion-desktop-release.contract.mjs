import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const [workflow, desktopPackageRaw, tauriRaw, cargo, nginx, dockerfile, webDeployWorkflow] =
  await Promise.all([
    read('.github/workflows/build-gestion-drive-desktop.yml'),
    read('apps/gestion-drive-desktop/package.json'),
    read('apps/gestion-drive-desktop/src-tauri/tauri.conf.json'),
    read('apps/gestion-drive-desktop/Cargo.toml'),
    read('nginx.azure.conf'),
    read('Dockerfile.azure'),
    read('.github/workflows/deploy-gestion-azure.yml'),
  ])

const desktopPackage = JSON.parse(desktopPackageRaw)
const tauri = JSON.parse(tauriRaw)
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]

function compareSemver(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}
const [moduleCapabilityRaw, pwaSource, tauriLibSource, tauriCargo, driveActions] = await Promise.all([
  read('apps/gestion-drive-desktop/src-tauri/capabilities/module-windows.json'),
  read('apps/gestion-drive-desktop/src-tauri/src/pwa.rs'),
  read('apps/gestion-drive-desktop/src-tauri/src/lib.rs'),
  read('apps/gestion-drive-desktop/src-tauri/Cargo.toml'),
  read('apps/gestion-drive-desktop/src-tauri/src/drive_actions.rs'),
])
const moduleCapability = JSON.parse(moduleCapabilityRaw)


assert.equal(desktopPackage.version, tauri.version, 'npm and Tauri versions must match')
assert.equal(desktopPackage.version, cargoVersion, 'npm and Cargo versions must match')
assert.ok(
  compareSemver(desktopPackage.version, '0.1.10') > 0,
  'the release must supersede the broken locally installed 0.1.10 build'
)
assert.match(
  nginx,
  new RegExp(
    `X-OpenPulse-Gestion-Version\\s+"azure-desktop-${desktopPackage.version.replaceAll('.', '\\.')}"`
  ),
  'the deployed web header must identify the candidate desktop release'
)
assert.match(dockerfile, /FROM nginx:1\.27-alpine@sha256:[0-9a-f]{64}/)
assert.match(
  dockerfile,
  /chmod -R a\+rX \/usr\/share\/nginx\/html\/desktop-downloads/,
  'Nginx must be able to read every updater manifest and installer copied from the build context'
)
assert.match(webDeployWorkflow, /desktop-downloads\/\$\{EXPECTED_DESKTOP_RELEASE_SHA\}\/latest\.json/)
assert.match(webDeployWorkflow, /deploy:[\s\S]*environment: gestion-production/)
assert.match(webDeployWorkflow, /node scripts\/verify-desktop-release\.mjs/)
assert.ok(
  webDeployWorkflow.indexOf('node scripts/verify-desktop-release.mjs') <
    webDeployWorkflow.indexOf("destination.write_text"),
  'the immutable checksums and payloads must be verified before hydrating public metadata'
)
assert.match(webDeployWorkflow, /platforms[\s\S]*darwin-aarch64/)
assert.match(webDeployWorkflow, /data-checksums/)

assert.doesNotMatch(
  workflow,
  /pull_request:/,
  'PR code must never reach signing runners or secrets'
)
assert.doesNotMatch(workflow, /self-hosted/, 'release/signing jobs must use ephemeral hosted runners')
assert.match(workflow, /environment: gestion-desktop-release/)
assert.match(workflow, /cancel-in-progress:\s*false/)
assert.match(workflow, /drive-api-ready:[\s\S]*\/readyz/)
assert.match(workflow, /source_sha[\s\S]*GITHUB_SHA/)
assert.match(workflow, /build:[\s\S]*needs:\s*\[contract, drive-api-ready\]/)
assert.match(workflow, /build:[\s\S]*if: github\.event_name == 'workflow_dispatch'/)
assert.doesNotMatch(workflow, /codesign\s+--force\s+--deep\s+--sign\s+-/)
assert.match(workflow, /APPLE_DEVELOPER_ID_P12_BASE64/)
assert.match(workflow, /notarytool submit/)
assert.match(workflow, /stapler validate/)
assert.match(workflow, /spctl --assess/)
assert.match(workflow, /WINDOWS_CODESIGN_PFX_BASE64/)
assert.match(workflow, /SIGNTOOL["']?\s+sign/)
assert.match(workflow, /SIGNTOOL["']?\s+verify/)
assert.match(workflow, /npm run test:contract/)
assert.match(workflow, /source = \{[\s\S]*'commit': source_sha/)
assert.match(workflow, /'source': source/)
assert.match(workflow, /canonical_repository': 'https:\/\/gitea\.marque-ia\.com\/marqueia\/marque-client-compass'/)
assert.match(workflow, /'sha256': hashlib\.sha256/)
assert.match(workflow, /checksums\.json/)
assert.match(workflow, /minisign -Vm "\$artifact" -x "\$signature" -P "\$TAURI_PUBLIC_KEY"/)
assert.match(workflow, /upload_immutable/)
assert.match(workflow, /--overwrite false/)
assert.doesNotMatch(workflow, /--name latest\.json/, 'a mutable root updater pointer is forbidden')
assert.match(workflow, /checksums\['assets'\]/)
assert.match(workflow, /desktop-downloads\/\{source_sha\}\//)
assert.ok(
  workflow.indexOf('Create verified draft release before public metadata') <
    workflow.indexOf('Upload and verify public installer blobs'),
  'a draft release tied to the exact SHA must exist before updater metadata changes'
)
assert.doesNotMatch(workflow, /if-no-files-found:\s*warn/)
assert.match(workflow, /if-no-files-found:\s*error/)
assert.doesNotMatch(workflow, /git push origin/, 'release automation must not mutate the canonical branch')
assert.match(workflow, /desktop_release_sha="\$GITHUB_SHA"/)
assert.match(
  workflow,
  /gh workflow run deploy-gestion-azure\.yml --ref "\$TAG" -f desktop_release_sha="\$GITHUB_SHA"/,
  'the web deployment must be dispatched from the immutable release tag'
)
assert.match(workflow, /headSha[\s\S]*GITHUB_SHA/)
assert.match(
  webDeployWorkflow,
  /test "\$GITHUB_SHA" = "\$EXPECTED_DESKTOP_RELEASE_SHA"/,
  'release hydration must refuse a workflow checkout from another SHA'
)
assert.match(webDeployWorkflow, /revision set-mode[\s\S]*--mode multiple/)
assert.match(webDeployWorkflow, /PRODUCTION_REVISIONS/)
assert.doesNotMatch(webDeployWorkflow, /latestReadyRevisionName/)
assert.match(webDeployWorkflow, /--revision-suffix/)
assert.match(webDeployWorkflow, /---candidate\./)
assert.match(webDeployWorkflow, /--revision-weight[\s\S]*=100[\s\S]*=0/)
assert.match(webDeployWorkflow, /rollback_candidate/)
assert.match(webDeployWorkflow, /revision deactivate/)
assert.doesNotMatch(webDeployWorkflow, /cancel-in-progress:\s*true/)
assert.match(webDeployWorkflow, /Hydrate verified Desktop updater metadata/)
assert.match(webDeployWorkflow, /EXPECTED_DESKTOP_RELEASE_SHA/)
assert.doesNotMatch(
  webDeployWorkflow,
  /retaining repository metadata/,
  'a web deploy must never fall back to the versioned legacy updater manifest'
)
assert.match(
  webDeployWorkflow,
  /CURRENT_DESKTOP_MANIFEST/,
  'ordinary web deploys must rehydrate the currently verified public manifest'
)
assert.match(
  webDeployWorkflow,
  /Version\s+\[\^<\]\+|Version\s+\{version\}|Version [^\n]+version/,
  'deployment must update the visible download-page version as well as the URLs'
)

assert.deepEqual(moduleCapability.windows, ['gestion-*'])
assert.ok(moduleCapability.permissions.includes('core:default'))
for (const forbidden of [
  'updater:default',
  'process:allow-restart',
  'autostart:allow-enable',
  'autostart:allow-disable',
  'global-shortcut:default',
]) {
  assert.ok(
    !moduleCapability.permissions.includes(forbidden),
    `module windows must not receive privileged permission ${forbidden}`
  )
}
assert.doesNotMatch(pwaSource, /WebviewUrl::External/)
assert.doesNotMatch(tauriLibSource, /pwa::open_pwa_window/)
assert.doesNotMatch(tauriLibSource, /tauri_plugin_clipboard_manager/)
assert.doesNotMatch(tauriCargo, /tauri-plugin-clipboard-manager/)
assert.match(driveActions, /pbcopy/)
assert.match(driveActions, /Set-Clipboard/)

console.log('Gestion Desktop release contract: OK')
