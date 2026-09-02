import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyIndexHtmlBranding } from '../../scripts/openpulseHtmlBranding'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const walk = (directory: string): string[] =>
  readdirSync(resolve(process.cwd(), directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? walk(path) : [path]
  })

const expectedThemeColors = {
  'public/manifest.webmanifest': '#CB5A1A',
  'public/manifest-mail.json': '#3280DD',
  'public/manifest-pulse.json': '#9065D0',
  'public/manifest-calendar.json': '#C3518E',
  'public/manifest-todos.json': '#31983D',
  'public/manifest-jarvis.json': '#0099AD',
} as const

const expectedMobileWrapperThemeColors = {
  'src/pages/mobile/MobileMailApp.tsx': '#3280DD',
  'src/pages/mobile/MobilePulseApp.tsx': '#9065D0',
  'src/pages/mobile/MobileCalendarApp.tsx': '#C3518E',
  'src/pages/mobile/MobileTodosApp.tsx': '#31983D',
  'src/pages/mobile/MobileJarvisApp.tsx': '#0099AD',
} as const

describe('contrat de marque OpenPulse', () => {
  it('embarque IBM Plex sans dépendance réseau au runtime', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
    }
    const main = read('src/main.tsx')
    const indexCss = read('src/index.css')
    const bodyRule = [...indexCss.matchAll(/\n\s*body\s*\{[^}]*\}/g)]
      .map(([rule]) => rule)
      .find((rule) => rule.includes('@apply bg-background text-foreground font-sans'))

    expect(packageJson.dependencies?.['@fontsource/ibm-plex-sans']).toBeDefined()
    expect(packageJson.dependencies?.['@fontsource/ibm-plex-mono']).toBeDefined()
    expect(main).toContain("import '@fontsource/ibm-plex-sans/400.css'")
    expect(main).toContain("import '@fontsource/ibm-plex-sans/500.css'")
    expect(main).toContain("import '@fontsource/ibm-plex-sans/600.css'")
    expect(main).toContain("import '@fontsource/ibm-plex-mono/400.css'")
    expect(bodyRule).toContain('@apply bg-background text-foreground font-sans')
    expect(bodyRule).not.toContain('font-family:')
  })

  it.each(Object.entries(expectedThemeColors))(
    'aligne %s sur la teinte normative',
    (path, expectedThemeColor) => {
      const manifest = JSON.parse(read(path)) as { theme_color?: string }
      expect(manifest.theme_color).toBe(expectedThemeColor)
    }
  )

  it.each(Object.entries(expectedMobileWrapperThemeColors))(
    'aligne le wrapper mobile %s sur sa teinte normative',
    (path, expectedColor) => {
      expect(read(path)).toContain(`themeColor="${expectedColor}"`)
    }
  )

  it.each(Object.keys(expectedMobileWrapperThemeColors))(
    'garde le wrapper mobile %s sur une surface plane',
    (path) => {
      const source = read(path)

      expect(source).not.toMatch(/\bbg-gradient(?:-[^\s"'`}]+)?/)
      expect(source).not.toMatch(/\b(?:shadow|drop-shadow)-(?!none\b)[^\s"'`}]+/)
    }
  )

  it('aligne la page d’installation mobile sur les quatre teintes normatives', () => {
    const source = read('src/pages/mobile/MobileAppInstallPage.tsx')

    for (const expectedColor of ['#3280DD', '#9065D0', '#C3518E', '#31983D']) {
      expect(source).toContain(`themeColor: '${expectedColor}'`)
    }
  })

  it('garde tous les amorçages pré-React alignés sur les mêmes teintes', () => {
    const index = read('index.html')
    const bootstrap = read('public/bootstrap-1.js')
    const fallback = read('public/bootstrap-4.js')
    const dynamicManifest = read('src/hooks/shared/useDynamicManifest.ts')

    const entries = [
      ["'/m/mail'", '/manifest-mail.json', '/icons/app-mail-192.png', '#3280DD'],
      ["'/m/pulse'", '/manifest-pulse.json', '/icons/app-pulse-192.png', '#9065D0'],
      ["'/m/calendrier'", '/manifest-calendar.json', '/icons/app-calendar-192.png', '#C3518E'],
      ["'/m/todos'", '/manifest-todos.json', '/icons/app-todos-192.png', '#31983D'],
      ["'/m/jarvis'", '/manifest-jarvis.json', '/icons/app-jarvis-192.png', '#0099AD'],
    ] as const

    for (const [route, manifest, icon, color] of entries) {
      for (const source of [index, bootstrap, dynamicManifest]) {
        expect(source, `${route} doit rester aligné dans chaque amorçage`).toContain(route)
        expect(source).toContain(manifest)
        expect(source).toContain(icon)
        expect(source).toContain(color)
      }
    }

    expect(index).toContain('<meta name="theme-color" content="#CB5A1A">')
    expect(index).toContain("font-family: 'IBM Plex Sans'")
    expect(index).toContain('background: #FAF6F3')
    expect(index).toContain('color: #201916')
    expect(fallback).toContain('background:#201916')

    const offline = read('public/offline.html')
    expect(offline).toContain('<meta name="theme-color" content="#CB5A1A" />')
    expect(offline).toContain("font-family: 'IBM Plex Sans'")
    expect(offline).toContain('background: #FAF6F3')
    expect(offline).toContain('color: #201916')
    expect(offline).not.toContain('prefers-color-scheme: dark')
  })

  it('remplace les variables HTML absentes par des valeurs sûres et cohérentes', () => {
    const transformed = applyIndexHtmlBranding(
      '<title>%VITE_MARQUE_NOM_PRODUIT%</title><meta content="%VITE_CSP_CONNECT_EXTRA%">',
      {}
    )

    expect(transformed).toContain('<title>OpenPulse</title>')
    expect(transformed).toContain('<meta content="">')
    expect(transformed).not.toMatch(/%VITE_[A-Z0-9_]+%/)
  })

  it('échappe le nom de produit injecté dans le HTML', () => {
    const transformed = applyIndexHtmlBranding('<title>%VITE_MARQUE_NOM_PRODUIT%</title>', {
      VITE_MARQUE_NOM_PRODUIT: 'Équipe & <Pulse>',
    })

    expect(transformed).toBe('<title>Équipe &amp; &lt;Pulse&gt;</title>')
  })

  it('refuse une valeur CSP capable d’injecter une directive supplémentaire', () => {
    expect(() =>
      applyIndexHtmlBranding('<meta content="%VITE_CSP_CONNECT_EXTRA%">', {
        VITE_CSP_CONNECT_EXTRA: "https://api.example.org; script-src 'unsafe-eval'",
      })
    ).toThrow(/VITE_CSP_CONNECT_EXTRA/)
  })

  it('normalise uniquement des origines CSP explicites', () => {
    const transformed = applyIndexHtmlBranding('<meta content="%VITE_CSP_CONNECT_EXTRA%">', {
      VITE_CSP_CONNECT_EXTRA: 'https://api.example.org/ wss://api.example.org',
    })

    expect(transformed).toBe('<meta content="https://api.example.org wss://api.example.org">')
  })

  it('compose une barre laterale en une seule colonne, sur des surfaces planes', () => {
    // La barre etait faite de deux morceaux : un rail de 60 px portant une icone
    // par section, et une colonne de 204 px portant les pages de la SEULE section
    // choisie. Elle est desormais d'un seul tenant, comme celle de Gestion.
    // Les deux assertions sur les surfaces planes, elles, ne bougent pas : elles
    // empechent de recopier les degrades et les ombres de la version d'origine.
    const css = read('src/index.css')
    const sidebar = read('src/components/AppSidebar.tsx')
    const app = read('src/App.tsx')

    expect(css).not.toContain('--rail-navigation')
    expect(css).not.toContain('--colonne-contextuelle')
    expect(sidebar).not.toContain('data-testid="navigation-rail"')
    expect(sidebar).toContain('collapsible="icon"')
    expect(sidebar).not.toMatch(/shadow-\[|bg-gradient-to-r/)
    expect(app).not.toMatch(/<header className="[^"]*(?:bg-gradient|backdrop-blur)[^"]*"/)
  })

  it('déclare des couleurs CSS valides pour OpenPulse et chaque sous-application', () => {
    const css = read('src/index.css')

    expect(css).toContain('--h-openpulse: #140e0b;')
    expect(css).toContain('--h-mail: #3280dd;')
    expect(css).toContain('--h-calendrier: #c3518e;')
    expect(css).toContain('--h-pulse: #9065d0;')
    expect(css).toContain('--h-taches: #31983d;')
    expect(css).toContain('--h-jarvis: #0099ad;')
  })

  it('compose le hero du tableau de bord avec les jetons et des surfaces planes', () => {
    const hero = read('src/components/dashboard/DashboardHero.tsx')

    expect(hero).toContain('bg-[hsl(var(--surface-immersive))]')
    expect(hero).not.toMatch(/\bbg-gradient(?:-[^\s"'`}]+)?/)
    expect(hero).not.toContain('<linearGradient')
    expect(hero).not.toMatch(/hsl\(\d/)
    expect(hero).not.toMatch(/shadow-\[/)
  })

  it('garde le fond du tableau de bord sur la surface applicative', () => {
    const dashboard = read('src/components/dashboard/DirectionDashboard.tsx')

    expect(dashboard).toContain('min-h-dvh bg-background')
    expect(dashboard).not.toMatch(/\bbg-gradient(?:-[^\s"'`}]+)?/)
    expect(dashboard).not.toMatch(/bg-\[hsl\(\d/)
  })

  it('consomme tous les jetons de sous-application dans des composants rendus', () => {
    const sources = [
      read('src/components/auth/AuthBrandingPanel.tsx'),
      read('src/components/AppSidebar.tsx'),
      read('src/pages/mobile/MobileJarvisApp.tsx'),
    ].join('\n')

    for (const token of [
      'h-openpulse',
      'h-mail',
      'h-pulse',
      'h-calendrier',
      'h-taches',
      'h-jarvis',
    ]) {
      expect(sources, `${token} doit être consommé hors du fichier déclaratif`).toContain(
        `var(--${token})`
      )
    }
  })

  it('réserve l’unique ombre de la charte aux surfaces superposées', () => {
    const css = read('src/index.css')
    const emailCss = read('src/styles/email-design-tokens.css')
    const tailwind = read('tailwind.config.ts')
    const html = read('index.html')
    const offline = read('public/offline.html')
    const boxShadowBlock = tailwind.match(/boxShadow:\s*\{([\s\S]*?)\n\s*\},/)?.[1]
    const dropShadowBlock = tailwind.match(/dropShadow:\s*\{([\s\S]*?)\n\s*\},/)?.[1]
    const configuredShadows = [
      ...(boxShadowBlock?.matchAll(/^\s*(?:'[^']+'|[\w-]+):\s*'([^']+)'/gm) ?? []),
    ].map((match) => match[1])
    const configuredDropShadows = [
      ...(dropShadowBlock?.matchAll(/^\s*(?:'[^']+'|[\w-]+):\s*'([^']+)'/gm) ?? []),
    ].map((match) => match[1])

    expect(configuredShadows.length).toBeGreaterThan(0)
    expect(new Set(configuredShadows)).toEqual(new Set(['none', '0 2px 6px rgba(32,25,22,.10)']))
    expect(configuredDropShadows.length).toBeGreaterThan(0)
    expect(new Set(configuredDropShadows)).toEqual(new Set(['none']))
    expect(html).toContain('<body id="openpulse-app">')
    expect(css).toContain(
      '#openpulse-app *,\n  #openpulse-app *::before,\n  #openpulse-app *::after'
    )
    expect(css).toContain('box-shadow: none !important;')
    expect(css).toContain('box-shadow: 0 2px 6px rgba(32, 25, 22, 0.1) !important;')
    expect(css).toContain('text-shadow: none !important;')
    expect(css).toContain("#openpulse-app [class*='drop-shadow']")
    expect(css).toContain('--tw-drop-shadow: drop-shadow(0 0 #0000) !important;')

    for (const token of [
      'shadow-soft',
      'shadow-accent',
      'shadow-medical',
      'shadow-paper',
      'shadow-toolbar',
      'shadow-slide',
    ]) {
      expect(css).toContain(`--${token}: none;`)
    }
    for (const token of ['email-shadow-hover', 'email-shadow-active', 'email-shadow-card']) {
      expect(emailCss).toContain(`--${token}: none;`)
    }

    expect(offline).not.toMatch(/(?:box|text)-shadow\s*:/)
  })

  it('rend une surface pleine sombre aux anciens en-têtes en dégradé', () => {
    const css = read('src/index.css')

    expect(css.match(/--surface-immersive:/g)).toHaveLength(2)
    expect(css).toContain("#openpulse-app [class*='from-[hsl(210,80%']")
    expect(css).toContain('background-color: hsl(var(--surface-immersive)) !important;')
  })

  it('ne laisse aucune teinte écrite en dur dans une classe utilitaire', () => {
    // POURQUOI CETTE GARDE
    // Une classe comme `bg-[hsl(210,80%,25%)]` contourne entièrement la charte :
    // ni le remappage de palette de tailwind.config.ts, ni les jetons de
    // src/index.css ne s'y appliquent. Le dépôt en portait 157, dont 86 en bleu
    // marine et 47 en bleu pâle — sur une charte chaude. Aucune épreuve ne les
    // voyait : le contrat de marque était vert pendant qu'elles étaient là.
    //
    // `[hsl(var(--jeton))]` reste permis : il PASSE par la charte, il ne la
    // contourne pas. Seule une valeur numérique littérale est refusée.
    const teinteLitterale = /\[(?:hsl|hsla|rgb|rgba)\(\s*[\d.]/gi
    // Ce fichier est exclu : il CITE les motifs qu'il interdit, dans l'assertion
    // du filet de securite ci-dessous et dans ce commentaire. Une epreuve ne
    // peut pas se contrôler elle-même sans se mordre la queue.
    const fautifs = walk('src')
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => !path.endsWith('openpulseBrandContract.test.ts'))
      .flatMap((path) =>
        [...read(path).matchAll(teinteLitterale)].map((match) => `${path}: ${match[0]}`)
      )

    expect(fautifs).toEqual([])
  })

  it('compose toutes les surfaces visibles sans dégradé', () => {
    const css = read('src/index.css')
    const gradient = /(?:linear|radial|conic)-gradient\(/gi
    const runtimeGuardSelectors = [
      "#openpulse-app [class*='gradient']",
      "#openpulse-app [style*='gradient']",
      "#openpulse-app [class*='gradient']::before",
      "#openpulse-app [style*='gradient']::before",
      "#openpulse-app [class*='gradient']::after",
      "#openpulse-app [style*='gradient']::after",
    ]

    for (const selector of runtimeGuardSelectors) {
      expect(css).toContain(selector)
    }

    const cssOffenders = walk('src')
      .filter((path) => path.endsWith('.css'))
      .flatMap((path) => [...read(path).matchAll(gradient)].map((match) => `${path}: ${match[0]}`))
    const outsideRootSources = [
      'src/components/etablissement-gantt/export/GanttExportHeader.tsx',
      ...walk('public').filter((path) => path.endsWith('.html')),
      ...walk('supabase/functions').filter((path) => path.endsWith('.ts')),
    ]
    const outsideRootOffenders = outsideRootSources.flatMap((path) =>
      [...read(path).matchAll(gradient)].map((match) => `${path}: ${match[0]}`)
    )

    expect(cssOffenders).toEqual([])
    expect(outsideRootOffenders).toEqual([])
  })

  it('garde également les sorties hors racine sans ombre', () => {
    const sources = [
      'src/App.css',
      'src/styles/email-design-tokens.css',
      ...walk('public').filter((path) => path.endsWith('.html')),
      ...walk('supabase/functions').filter((path) => path.endsWith('.ts')),
    ]
    const offenders = sources.flatMap((path) =>
      [
        ...read(path).matchAll(
          /(?:box|text)-shadow\s*:\s*([^;}\n]+)|filter\s*:\s*(drop-shadow\([^)]*\))/gi
        ),
      ]
        .filter((match) => (match[1] ?? match[2]).trim().toLowerCase() !== 'none')
        .map((match) => `${path}: ${match[0]}`)
    )

    expect(offenders).toEqual([])
  })

  it('garde les pages HTML publiques sur des surfaces planes', () => {
    const offenders = walk('public')
      .filter((path) => path.endsWith('.html'))
      .flatMap((path) =>
        [...read(path).matchAll(/(?:linear|radial)-gradient\(/gi)].map(
          (match) => `${path}: ${match[0]}`
        )
      )

    expect(offenders).toEqual([])
  })

  it('interdit les dégradés sur tous les contrôles interactifs', () => {
    const interactiveTag = /<(?:Button|button|a|Link|NavLink)\b[\s\S]*?(?<![=])>/g
    const gradient = /\bbg-gradient-to-|(?:linear|radial)-gradient\(/
    const componentOffenders = walk('src')
      .filter(
        (path) =>
          /\.(?:tsx|jsx)$/.test(path) &&
          !path.includes('/__tests__/') &&
          !/\.(?:test|spec)\./.test(path)
      )
      .flatMap((path) =>
        [...read(path).matchAll(interactiveTag)]
          .filter((match) => gradient.test(match[0]))
          .map((match) => `${path}:${read(path).slice(0, match.index).split('\n').length}`)
      )
    const downloads = read('public/desktop-downloads/index.html')
    const downloadCta = downloads.match(/\.cta\{[^}]*\}/)?.[0] ?? ''

    expect(componentOffenders).toEqual([])
    expect(downloadCta).not.toMatch(gradient)
  })

  it('garde la connexion plate, sans dégradé, flou ni ombre intérieure', () => {
    const authSources = [
      read('src/pages/Auth.tsx'),
      read('src/components/auth/AnimatedFormCard.tsx'),
      read('src/components/auth/MobileAuthHeader.tsx'),
    ].join('\n')

    expect(authSources).not.toMatch(/\bbg-gradient(?:-[^\s"'`}]+)?/)
    expect(authSources).not.toMatch(
      /\b(?:shadow|drop-shadow|backdrop-blur|blur)-(?!none\b)[^\s"'`}]+/
    )
  })
})
