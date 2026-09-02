// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const repoFile = (path: string) => new URL(`../../${path}`, import.meta.url)

function directive(policy: string, name: string) {
  return policy
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name} `))
}

async function readMetaCsp() {
  const html = await readFile(repoFile('index.html'), 'utf8')
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)

  expect(match?.[1]).toBeDefined()
  return match![1]
}

async function readHeaderCsp(path: string) {
  const source = await readFile(repoFile(path), 'utf8')
  const match =
    path === 'public/_headers'
      ? source.match(/Content-Security-Policy:\s*([^\r\n]+)/)
      : source.match(/Content-Security-Policy[^"]*"([^"]+)"/)

  expect(match?.[1]).toBeDefined()
  return match![1]
}

function expectExplicitRemoteSources(policy: string) {
  expect(policy).not.toMatch(/(?:^|\s)https:(?:\s|;|$)/)
  expect(policy).not.toMatch(/(?:^|\s)wss:(?:\s|;|$)/)
  expect(policy).not.toMatch(/https?:\/\/\*\./)
  expect(policy).not.toMatch(/wss?:\/\/\*\./)
}

describe('Content Security Policy contract', () => {
  it('keeps the HTML meta CSP compatible with the inline PWA/bootstrap loaders without broad script execution', async () => {
    const policy = await readMetaCsp()
    const scriptSrc = directive(policy, 'script-src')

    expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc).not.toContain('https:')
    expect(directive(policy, 'frame-ancestors')).toBeUndefined()
    expectExplicitRemoteSources(policy)
  })

  // `nginx.azure.conf` est revenu dans cette liste : il ne portait aucune CSP,
  // seulement quatre en-têtes, et avait donc été retiré du contrat plutôt que
  // corrigé — ce qui laissait le déploiement Azure sans `frame-ancestors`.
  it.each(['public/_headers', 'docker/nginx/frontend.conf', 'nginx.azure.conf'])(
    'keeps the static-host template explicit and hardened in %s',
    async (path) => {
      const policy = await readHeaderCsp(path)
      const scriptSrc = directive(policy, 'script-src')

      expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline'")
      expect(scriptSrc).not.toContain("'unsafe-eval'")
      expect(scriptSrc).not.toContain('https:')

      const frameAncestors = directive(policy, 'frame-ancestors')
      expect(frameAncestors).toBeDefined()
      expect(frameAncestors).not.toContain('apercu.example.org')
      expect(frameAncestors).not.toContain('generation.example.org')

      // `frame-src` n'autorise plus aucun hôte tiers. Le contrat exigeait
      // auparavant trois gabarits (`forge.`, `design.`, `sso.exploitant.example.org`)
      // que le commit 41d03b1 a retirés en durcissant la politique : il
      // réclamait donc le retour de ce qu'on venait d'écarter, et échouait
      // depuis. Ce qui est verrouillé maintenant, c'est le durcissement.
      const frameSrc = directive(policy, 'frame-src')
      expect(frameSrc).toBe("frame-src 'self'")
      for (const gabarit of [
        'forge.exploitant.example.org',
        'design.exploitant.example.org',
        'sso.exploitant.example.org',
      ]) {
        expect(policy).not.toContain(gabarit)
      }

      const connectSrc = directive(policy, 'connect-src')
      expect(connectSrc).toContain('https://VOTRE-API')
      expect(connectSrc).toContain('wss://VOTRE-API')
      expect(policy).not.toContain('.example.org')
      expectExplicitRemoteSources(policy)
    }
  )

  // Le contrat ci-dessus couvre trois fichiers que la composition de reference
  // n'utilise PAS. La configuration reellement servie est engendree dans
  // `docker/Dockerfile.openpulse` : l'instance ne servait donc aucun en-tete de
  // securite alors que trois fichiers du depot les definissaient, et aucune
  // epreuve ne pouvait le voir. C'est ce fichier-la qu'on verrouille ici.
  it('sert les en-tetes de securite depuis la configuration reellement construite', async () => {
    const dockerfile = await readFile(repoFile('docker/Dockerfile.openpulse'), 'utf8')

    for (const entete of [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(dockerfile, `en-tete ${entete} absent de la configuration servie`).toContain(
        `add_header ${entete}`
      )
    }

    // `frame-ancestors` est la seule directive qui protege de l'encadrement, et
    // elle est inoperante en balise meta : elle doit venir de l'en-tete.
    expect(dockerfile).toContain('frame-ancestors')

    // Piege nginx : un `add_header` dans un `location` annule ceux herites du
    // serveur. Chaque bloc qui en declare un doit donc reinclure le fragment,
    // sinon les en-tetes disparaissent precisement sur index.html.
    const blocsAvecEnteteLocal = dockerfile
      .split('\n')
      .filter((ligne) => /location[^']*add_header/.test(ligne))
    expect(blocsAvecEnteteLocal.length).toBeGreaterThan(0)
    for (const bloc of blocsAvecEnteteLocal) {
      expect(bloc, `location sans reinclusion du fragment : ${bloc.trim()}`).toContain(
        'snippets-securite.conf'
      )
    }
  })
})
