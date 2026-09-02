# Power Pack — Éditeurs Office-parity

Modules additifs pour porter les éditeurs OpenPulse au niveau de Microsoft Office.

## Fonctions livrées

| Fichier | Rôle | Éditeur cible |
| --- | --- | --- |
| `formulaEngine.ts` | Moteur HyperFormula (~400 fonctions Excel-grade) | Tableur |
| `importXlsx.ts` | Import XLSX (styles + formules) → `SheetState` | Tableur |
| `ChartInsertDialog.tsx` | Insertion de graphique SVG (barres/ligne/camembert) | Tableur |
| `ConditionalFormattingDialog.tsx` | Règles de formatage conditionnel (>, <, =, between, contains) | Tableur |
| `FindReplaceDialog.tsx` | Recherche & remplacement (regex, casse, mot entier) | Document |
| `WordCountBar.tsx` | Statistiques temps réel (mots, caractères, pages, lecture) | Document |
| `PageSetupDialog.tsx` | Format / orientation / marges (A4/A3/Letter/Legal) | Document |
| `MailMergeDialog.tsx` | Publipostage CSV → PDF (placeholders `{{col}}`) | Document |
| `PresenterMode.tsx` | Mode Présentateur (plein écran + notes + chrono + prochaine slide) | Présentation |

## Notes techniques

- **HyperFormula** est instancié en singleton et resynchronisé à chaque changement de contenu du tableur. Il expose ~400 fonctions Excel (`VLOOKUP`, `INDEX/MATCH`, `IFS`, `SUMIFS`, `TEXT`, `DATE`, financières, statistiques, ingénierie…).
- L'import XLSX conserve les formules (préfixées par `=`), les styles gras/italique/couleur/alignement, la couleur de fond et les largeurs de colonne.
- Le Presenter Mode capture les touches `←/→/PageUp/PageDown/Espace/Home/End/Esc` et bascule automatiquement en plein écran.
- Le publipostage détecte les placeholders `{{colonne}}` déjà présents dans le document et génère un PDF par ligne CSV.
- Les règles de formatage conditionnel sont sérialisables et stockées avec le document (utilisez `evaluateCfRule` au rendu de chaque cellule).
