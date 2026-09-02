import { Page } from '@playwright/test'

/**
 * Helpers de ciblage pour la liste des établissements.
 *
 * Historique : les specs ciblaient `tr, [class*="card"]` au niveau de la page.
 * Ce sélecteur est trop large — il matche aussi des éléments du shell
 * applicatif (badge de notification Jarvis, cartes de résumé), et `.first()`
 * tombait alors sur un élément qui ne navigue pas. Le test passait ou échouait
 * selon qu'une notification était présente ou non : faux rouge intermittent
 * (constaté le 2026-08-14, alors que le même commit était vert le 2026-08-12).
 *
 * On cible désormais explicitement les cartes d'établissement via
 * `data-testid="etablissement-card"` (cf. `EnhancedEtablissementCard`), en
 * restant tolérant à la vue « Tableau » qui rend des lignes `<tbody tr>`.
 * Le scope `#main-content` exclut définitivement la navigation et l'en-tête.
 */
export function firstEtablissementItem(page: Page) {
  return page
    .locator('#main-content')
    .locator('[data-testid="etablissement-card"], tbody tr')
    .first()
}
