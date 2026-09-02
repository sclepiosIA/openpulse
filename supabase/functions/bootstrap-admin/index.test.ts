import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { createBootstrapHandler, type BootstrapDependencies } from './index.ts'

function dependencies(overrides: Partial<BootstrapDependencies> = {}): BootstrapDependencies {
  return {
    installationRequired: async () => true,
    verifyInstallationCode: async () => true,
    claimInstallation: async () => true,
    releaseInstallation: async () => undefined,
    completeInstallation: async () => undefined,
    createAdmin: async () => ({ id: 'admin-id' }),
    ...overrides,
  }
}

Deno.test('status indique qu’une instance vierge requiert une installation', async () => {
  const response = await createBootstrapHandler(dependencies())(
    new Request('http://localhost', { method: 'POST', body: JSON.stringify({ action: 'status' }) })
  )
  assertEquals(response.status, 200)
  assertEquals(await response.json(), { installation_requise: true })
})

Deno.test('un code d’installation invalide ne peut pas créer le premier admin', async () => {
  let creationAppelee = false
  const response = await createBootstrapHandler(
    dependencies({
      verifyInstallationCode: async () => false,
      createAdmin: async () => {
        creationAppelee = true
        return { id: 'admin-id' }
      },
    })
  )(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        email: 'admin@openpulse.test',
        password: 'MotDePasse!2026',
        prenom: 'Andréï',
        nom: 'Galindo',
        installation_code: 'incorrect',
      }),
    })
  )
  assertEquals(response.status, 403)
  assertEquals(creationAppelee, false)
})

Deno.test('une seule requête peut revendiquer l’installation', async () => {
  const response = await createBootstrapHandler(
    dependencies({ claimInstallation: async () => false })
  )(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        email: 'admin@openpulse.test',
        password: 'MotDePasse!2026',
        prenom: 'Andréï',
        nom: 'Galindo',
        installation_code: 'code-installation',
      }),
    })
  )
  assertEquals(response.status, 409)
})

Deno.test('la création réussie ferme définitivement l’installation', async () => {
  let terminee = ''
  const response = await createBootstrapHandler(
    dependencies({
      completeInstallation: async (id) => {
        terminee = id
      },
    })
  )(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        email: 'admin@openpulse.test',
        password: 'MotDePasse!2026',
        prenom: 'Andréï',
        nom: 'Galindo',
        installation_code: 'code-installation',
      }),
    })
  )
  assertEquals(response.status, 200)
  assertEquals(await response.json(), { success: true })
  assertEquals(terminee, 'admin-id')
})
