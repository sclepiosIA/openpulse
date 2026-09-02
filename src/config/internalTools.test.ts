import { describe, expect, it } from 'vitest'
import { resolveInternalToolPresentation } from './internalTools'

describe('resolveInternalToolPresentation', () => {
  it('autorise Gitea en iframe uniquement avec le contrat SSO vérifié sur le parent Desktop same-site', () => {
    expect(
      resolveInternalToolPresentation(
        'gitea',
        {
          url: 'https://forge.exploitant.example.org/',
          launchUrl: 'https://forge.exploitant.example.org/user/oauth2/authentik',
          embed: true,
          ssoMode: 'authentik-oidc',
          readiness: 'verified',
        },
        {
          embedRuntimeEnabled: true,
          parentOrigin: 'https://espace.exploitant.example.org',
        }
      )
    ).toEqual({
      mode: 'iframe',
      url: 'https://forge.exploitant.example.org/user/oauth2/authentik',
    })
  })

  it('refuse une URL de lancement qui transporte un credential dans la query', () => {
    expect(
      resolveInternalToolPresentation(
        'gitea',
        {
          url: 'https://forge.exploitant.example.org/',
          launchUrl:
            'https://forge.exploitant.example.org/user/oauth2/authentik?access_token=secret',
          embed: true,
          ssoMode: 'authentik-oidc',
          readiness: 'verified',
        },
        {
          embedRuntimeEnabled: true,
          parentOrigin: 'https://espace.exploitant.example.org',
        }
      )
    ).toEqual({ mode: 'disabled', reason: 'unsafe-launch-url' })
  })

  it('conserve les hôtes nip.io existants en fallback externe sans jamais les autoriser en iframe', () => {
    expect(
      resolveInternalToolPresentation(
        'gitea',
        {
          url: 'https://gitea.openpulse.example.org/',
          launchUrl: 'https://gitea.openpulse.example.org/user/oauth2/authentik',
          embed: true,
          ssoMode: 'authentik-oidc',
          readiness: 'verified',
        },
        {
          embedRuntimeEnabled: true,
          parentOrigin: 'https://espace.exploitant.example.org',
        }
      )
    ).toEqual({
      mode: 'external',
      url: 'https://gitea.openpulse.example.org/',
      reason: 'embed-not-verified',
    })
  })

  it.each([
    ['readiness pending', 'pending', 'https://espace.exploitant.example.org'],
    ['parent nip.io de transition', 'verified', 'https://espace.openpulse.example.org'],
  ])(
    'conserve un fallback externe sûr quand %s',
    (_case, readiness, parentOrigin) => {
      expect(
        resolveInternalToolPresentation(
          'gitea',
          {
            url: 'https://forge.exploitant.example.org/',
            externalUrl: 'https://gitea.openpulse.example.org/',
            launchUrl: 'https://forge.exploitant.example.org/user/oauth2/authentik',
            embed: true,
            ssoMode: 'authentik-oidc',
            readiness,
          },
          { embedRuntimeEnabled: true, parentOrigin }
        )
      ).toEqual({
        mode: 'external',
        url: 'https://gitea.openpulse.example.org/',
        reason: 'embed-not-verified',
      })
    }
  )

  it.each([
    ['credentials', ['https://user', 'placeholder@forge.exploitant.example.org/'].join(':')],
    ['query', 'https://forge.exploitant.example.org/?redirect=https://evil.example'],
    ['non-root path', 'https://forge.exploitant.example.org/admin'],
  ])('refuse une URL configurée canonique en apparence mais contenant %s', (_case, url) => {
    expect(
      resolveInternalToolPresentation(
        'gitea',
        { url },
        {
          embedRuntimeEnabled: false,
          parentOrigin: 'https://espace.exploitant.example.org',
        }
      )
    ).toEqual({ mode: 'disabled', reason: 'unsafe-configured-url' })
  })

  it.each([
    ['credentials', ['https://user', 'placeholder@gitea.openpulse.example.org/'].join(':')],
    ['query', 'https://gitea.openpulse.example.org/?redirect=https://evil.example'],
    ['non-root path', 'https://gitea.openpulse.example.org/admin'],
  ])('refuse un fallback externe contenant %s', (_case, externalUrl) => {
    expect(
      resolveInternalToolPresentation(
        'gitea',
        {
          url: 'https://forge.exploitant.example.org/',
          externalUrl,
          readiness: 'pending',
        },
        {
          embedRuntimeEnabled: false,
          parentOrigin: 'https://espace.exploitant.example.org',
        }
      )
    ).toEqual({ mode: 'disabled', reason: 'unsafe-external-url' })
  })
})
