import { useMarque } from '@/config/FournisseurMarque'
// Variante CLAIRE du lettrage, destinee aux fonds sombres. Le logo par
// defaut peint son texte en encre (#201916) : pose sur le panneau, qui est
// de cette meme encre, il disparaissait -- seul le point d'accent restait
// visible, et l'ecran de connexion s'ouvrait sans marque. La charte fournit
// les deux verrouillages ; le depot n'embarquait que celui pour fond clair.
import logoMarque from '@/assets/marque/logo-sombre.svg'

/**
 * Panneau de gauche de l'écran de connexion, conforme à la maquette de charte
 * « La grille » (ecrans/01-connexion.png).
 *
 * CE QUI A CHANGÉ, ET POURQUOI
 * La version précédente empilait quatre arguments produit à icônes, trois
 * vagues et six halos flottants sur un fond sombre. La maquette retire tout
 * cela : un aplat d'encre, une accroche, un paragraphe, trois mentions en
 * chasse fixe. Le panneau ne vend plus le produit, il dit ce qu'est
 * l'instance — ce qui est le propos d'un logiciel auto-hébergé.
 *
 * LES TROIS MENTIONS SONT VÉRIFIÉES, PAS DÉCORATIVES
 * La maquette proposait « chiffrement au repos actif » et « journal d'audit
 * 90 jours ». Ces deux affirmations dépendent de l'installation : les écrire
 * en dur sur l'écran de connexion reviendrait à promettre à chaque exploitant
 * quelque chose que la distribution ne garantit pas. Elles sont remplacées par
 * trois faits qui tiennent sur toute instance :
 *
 *   - auto-hébergée : c'est la définition même de la distribution ;
 *   - aucune télémétrie par défaut : le module d'analytique ne s'active que si
 *     l'exploitant renseigne VITE_PLAUSIBLE_DOMAIN ou VITE_MATOMO_SITE_ID
 *     (cf. src/lib/pwa-analytics.ts) — d'où « par défaut », et non « aucune » ;
 *   - licence MIT : c'est celle du dépôt.
 *
 * L'ACCENT NE PORTE PAS DE TEXTE
 * Règle de la charte : l'accent #CB5A1A ne sert qu'aux surfaces actives, aux
 * badges, aux états d'alerte et aux titres. Il n'apparaît donc ici que sur les
 * puces et sur le mot mis en avant de l'accroche.
 */
export function AuthBrandingPanel() {
  const marque = useMarque()

  const mentions = ['instance auto-hébergée', 'aucune télémétrie par défaut', 'licence MIT']

  return (
    <div className="relative z-10 flex h-full flex-col justify-between bg-[var(--h-openpulse)] px-12 py-14 xl:px-16">
      <img
        src={logoMarque}
        alt={marque.nomProduit}
        className="h-8 w-auto self-start"
        width={430}
        height={100}
        {...({ fetchpriority: 'high' } as Record<string, string>)}
      />

      <div className="max-w-xl">
        <h1 className="text-4xl font-light leading-[1.15] text-marque-papier xl:text-5xl">
          Vos données restent
          <br />
          <span className="font-semibold">chez vous.</span>
        </h1>

        <p className="mt-7 max-w-md text-base leading-relaxed text-marque-douce/75">
          Cette instance est la vôtre : une base, un domaine, et le code que vous pouvez lire.
        </p>

        <ul className="mt-10 space-y-3">
          {mentions.map((mention) => (
            <li key={mention} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-marque-point"
              />
              <span className="font-mono text-sm text-marque-douce/70">{mention}</span>
            </li>
          ))}
        </ul>
      </div>

      <nav
        aria-label="Informations légales"
        className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-marque-douce/55"
      >
        <span>Licence MIT</span>
        <a href="/mentions-legales" className="transition-colors hover:text-marque-papier">
          Mentions légales
        </a>
        <a href="/politique-confidentialite" className="transition-colors hover:text-marque-papier">
          RGPD
        </a>
      </nav>
    </div>
  )
}
