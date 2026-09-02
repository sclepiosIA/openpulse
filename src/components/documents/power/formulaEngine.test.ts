import { describe, it, expect } from 'vitest';
import { evaluateCell, FormulaEngine, listFunctions, type SheetLike } from './formulaEngine';

/**
 * Ce fichier garde des défauts RÉELS, tous mesurés sur le moteur avant
 * correction. Chacun produisait un résultat FAUX sans la moindre erreur — le
 * cas le plus dangereux dans un tableur, puisque personne ne le voit.
 *
 * L'ordre suit la gravité, pas l'organisation du code.
 */

function sheet(cells: Record<string, string>): SheetLike {
  const data: SheetLike['data'] = {};
  for (const [k, v] of Object.entries(cells)) {
    if (v.startsWith('=')) data[k] = { formula: v };
    else data[k] = { value: v };
  }
  return { data, rowCount: 20, colCount: 10 };
}

const ev = (cells: Record<string, string>, cle: string) => evaluateCell(sheet(cells), cle);

describe('formulaEngine — bases', () => {
  it('additionne des constantes', () => {
    expect(ev({ A1: '=1+2' }, 'A1')).toBe('3');
  });

  it('résout une référence de cellule', () => {
    expect(ev({ A1: '10', B1: '=A1*2' }, 'B1')).toBe('20');
  });

  it('applique SUM sur une plage', () => {
    expect(ev({ A1: '1', A2: '2', A3: '3', A4: '=SUM(A1:A3)' }, 'A4')).toBe('6');
  });

  it('respecte la précédence', () => {
    expect(ev({ A1: '=2+3*4' }, 'A1')).toBe('14');
    expect(ev({ A1: '=(2+3)*4' }, 'A1')).toBe('20');
  });

  it('gère la division par zéro', () => {
    expect(ev({ A1: '=1/0' }, 'A1')).toBe('#DIV/0!');
  });

  it('renvoie #REF! sur une clé invalide', () => {
    expect(ev({}, 'INVALID')).toBe('#REF!');
  });

  it('IF renvoie la bonne branche', () => {
    expect(ev({ A1: '=IF(1>0,"oui","non")' }, 'A1')).toBe('oui');
  });

  it('refuse une fonction inconnue plutôt que d’inventer', () => {
    expect(ev({ A1: '=TOTO(1)' }, 'A1')).toBe('#NOM?');
  });

  it('expose une liste de fonctions non vide', () => {
    const fns = listFunctions();
    expect(fns.length).toBeGreaterThan(50);
    expect(fns).toContain('SUM');
  });
});

describe('formulaEngine — le cache ne doit jamais rendre une valeur périmée', () => {
  it('voit une cellule modifiée EN PLACE, sans changement de référence', () => {
    // LE DÉFAUT LE PLUS GRAVE. L'éditeur modifie les cellules en place ; le
    // cache était indexé par la référence de `data`, qui ne change pas. Mesuré :
    // B1 rendait 20, puis TOUJOURS 20 après passage de A1 à 50 — à vie.
    const f = sheet({ A1: '10', B1: '=A1*2' });
    const moteur = new FormulaEngine();
    expect(moteur.evaluateCell(f, 'B1')).toBe('20');
    f.data.A1.value = '50';
    expect(moteur.evaluateCell(f, 'B1')).toBe('100');
    moteur.destroy();
  });

  it('rend le même résultat quelle que soit la casse de la clé', () => {
    // Le cache indexait par la clé telle qu'écrite : `B1` et `b1` avaient deux
    // entrées, qui pouvaient diverger.
    const f = sheet({ A1: '3', B1: '=A1+1' });
    const moteur = new FormulaEngine();
    expect(moteur.evaluateCell(f, 'B1')).toBe(moteur.evaluateCell(f, 'b1'));
    moteur.destroy();
  });
});

describe('formulaEngine — le séparateur d’arguments et la virgule décimale', () => {
  it('lit la virgule comme une décimale quand le point-virgule sépare', () => {
    // `=SOMME(2,5;1)` était lu comme trois arguments — 2, 5 et 1 — et rendait
    // 8 au lieu de 3,5. Une somme fausse, sans aucun signe, pour tout
    // utilisateur francophone.
    expect(ev({ A1: '=SOMME(2,5;1)' }, 'A1')).toBe('3.5');
    expect(ev({ A1: '=MOYENNE(1,5;2,5)' }, 'A1')).toBe('2');
    expect(ev({ A1: '=1,5+1' }, 'A1')).toBe('2.5');
  });

  it('garde la virgule comme séparateur en l’absence de point-virgule', () => {
    expect(ev({ A1: '=SUM(1,2)' }, 'A1')).toBe('3');
  });
});

describe('formulaEngine — un texte n’est un nombre que s’il en a la forme', () => {
  it('ne compte pas un code hexadécimal, octal ou binaire comme un nombre', () => {
    // `Number()` accepte 0x1A, 0o17, 0b101. Une colonne de références produit
    // était donc additionnée : la somme de « 0x1A » et « 10 » rendait 36.
    expect(ev({ A1: '0x1A', A2: '10', A3: '=SUM(A1:A2)' }, 'A3')).toBe('10');
    expect(ev({ A1: '0b101', A2: '=SUM(A1:A1)' }, 'A2')).toBe('0');
    expect(ev({ A1: '0o17', A2: '=A1+0' }, 'A2')).toBe('#VALEUR!');
  });

  it('refuse « Infinity » et le texte non numérique', () => {
    expect(ev({ A1: 'Infinity', A2: '=A1+1' }, 'A2')).toBe('#VALEUR!');
    expect(ev({ A1: '=„abc“+1' }, 'A1')).toMatch(/^#/);
  });
});

describe('formulaEngine — l’affichage ne doit pas fabriquer des zéros', () => {
  it('affiche une petite valeur au lieu de l’écraser à zéro', () => {
    // `toFixed(12)` rendait « 0 » pour tout ce qui est sous 5e-13, pendant que
    // `=…=0` répondait FAUX : un total contredisait ses propres lignes.
    const rendu = ev({ A1: '=1/1E15' }, 'A1');
    expect(rendu).not.toBe('0');
    expect(Number(rendu)).toBeCloseTo(1e-15, 20);
  });

  it('reste cohérent entre l’affichage et la comparaison', () => {
    const f = sheet({ A1: '0.0000000000001', B1: '=IF(A1=0,"nul","non nul")' });
    const moteur = new FormulaEngine();
    expect(moteur.evaluateCell(f, 'B1')).toBe('non nul');
    expect(moteur.evaluateCell(f, 'A1')).not.toBe('0');
    moteur.destroy();
  });
});

describe('formulaEngine — comparaisons, dans l’ordre d’Excel', () => {
  it('ne déclare pas un nombre égal au texte qui lui ressemble', () => {
    expect(ev({ A1: '=1="1"' }, 'A1')).toBe('FAUX');
    expect(ev({ A1: '=1<>"1"' }, 'A1')).toBe('VRAI');
  });

  it('classe tout nombre avant tout texte', () => {
    // Avec A1=5 (nombre) et B1="+50" (texte), `=A1>B1` rendait VRAI : « 5 est
    // supérieur à 50 ». Un seuil d'alerte s'en trouvait inversé.
    expect(ev({ A1: '5', B1: '+50', C1: '=IF(A1>B1,"A>B","A<=B")' }, 'C1')).toBe('A<=B');
    expect(ev({ A1: '=2>"1"' }, 'A1')).toBe('FAUX');
    expect(ev({ A1: '="1">2' }, 'A1')).toBe('VRAI');
  });

  it('traite une cellule vide comme zéro face à un nombre', () => {
    // `=A1>=0` sur une cellule vide rendait FAUX : la cellule était déclarée
    // négative.
    expect(ev({ B1: '=IF(A1>=0,"ok","négatif")' }, 'B1')).toBe('ok');
    expect(ev({ B1: '=A1=0' }, 'B1')).toBe('VRAI');
  });

  it('place les booléens après les nombres', () => {
    expect(ev({ A1: '=TRUE>1' }, 'A1')).toBe('VRAI');
    expect(ev({ A1: '=TRUE=1' }, 'A1')).toBe('FAUX');
  });
});

describe('formulaEngine — arrondis et bornes', () => {
  it('arrondit les demis à l’écart de zéro, comme Excel', () => {
    // `Math.round` rendait -2 pour -2,5 : la symétrie était brisée sur les
    // montants négatifs.
    expect(ev({ A1: '=ROUND(2.5,0)' }, 'A1')).toBe('3');
    expect(ev({ A1: '=ROUND(-2.5,0)' }, 'A1')).toBe('-3');
  });

  it('arrondit correctement une valeur binairement inexacte', () => {
    // 1,005 vaut 1,00499999999999989 en virgule flottante : l'arrondi naïf
    // rendait 1 au lieu de 1,01.
    expect(ev({ A1: '=ROUND(1.005,2)' }, 'A1')).toBe('1.01');
  });

  it('transforme un dépassement de capacité en erreur, pas en infini', () => {
    // `=1E200*1E200` affichait « #DIV/0! » tout en restant Infinity :
    // IFERROR ne le rattrapait pas et `=1/(…)` rendait 0.
    expect(ev({ A1: '=1E200*1E200' }, 'A1')).toBe('#NOMBRE!');
    expect(ev({ A1: '=IFERROR(1E200*1E200,"secours")' }, 'A1')).toBe('secours');
    expect(ev({ A1: '=ISERROR(1E200*1E200)' }, 'A1')).toBe('VRAI');
  });

  it('évalue les puissances de gauche à droite, comme Excel', () => {
    // `=2^3^2` vaut 64 dans Excel et LibreOffice, pas 512.
    expect(ev({ A1: '=2^3^2' }, 'A1')).toBe('64');
  });
});

describe('formulaEngine — les fonctions ne doivent pas mentir', () => {
  it('CEILING et FLOOR emploient un pas de 1 par défaut', () => {
    expect(ev({ A1: '=CEILING(1.4)' }, 'A1')).toBe('2');
    expect(ev({ A1: '=FLOOR(9.9)' }, 'A1')).toBe('9');
  });

  it('SUBSTITUTE n’honore que l’occurrence demandée', () => {
    // Le quatrième argument était ignoré : les DEUX tirets d'une date étaient
    // remplacés.
    expect(ev({ A1: '=SUBSTITUTE("2026-01-01","-","/",1)' }, 'A1')).toBe('2026/01-01');
    expect(ev({ A1: '=SUBSTITUTE("2026-01-01","-","/")' }, 'A1')).toBe('2026/01/01');
  });

  it('TEXT refuse un format qu’il ne sait pas appliquer', () => {
    // Il acceptait le format et le jetait : `=TEXT(0,5;"0.00%")` rendait
    // « 0.5 », ce qui laisse croire à un formatage.
    expect(ev({ A1: '=TEXT(0.5,"0.00%")' }, 'A1')).toBe('#NOM?');
    expect(ev({ A1: '=TEXT(0.5)' }, 'A1')).toBe('0.5');
  });

  it('MID refuse un indice de départ inférieur à 1', () => {
    expect(ev({ A1: '=MID("abc",0,2)' }, 'A1')).toBe('#VALEUR!');
    expect(ev({ A1: '=MID("abc",2,2)' }, 'A1')).toBe('bc');
  });

  it('MIN et MAX sans argument rendent une erreur, pas zéro', () => {
    expect(ev({ A1: '=MIN()' }, 'A1')).toMatch(/^#/);
    expect(ev({ A1: '=MAX()' }, 'A1')).toMatch(/^#/);
  });
});

describe('formulaEngine — cycles et robustesse', () => {
  it('coupe un cycle direct', () => {
    expect(ev({ A1: '=A1' }, 'A1')).toBe('#CYCLE!');
  });

  it('coupe un cycle indirect', () => {
    expect(ev({ A1: '=B1', B1: '=A1' }, 'A1')).toBe('#CYCLE!');
  });

  it('supporte une chaîne longue de dépendances sans déborder', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let i = 2; i <= 120; i++) cells[`A${i}`] = `=A${i - 1}+1`;
    expect(ev(cells, 'A120')).toBe('120');
  });

  it('refuse une formule mal formée plutôt que de deviner', () => {
    expect(ev({ A1: '=(1+2' }, 'A1')).toMatch(/^#/);
    expect(ev({ A1: '=1+' }, 'A1')).toMatch(/^#/);
    expect(ev({ A1: '="abc' }, 'A1')).toMatch(/^#/);
  });

  it('gère les colonnes au-delà de Z', () => {
    expect(ev({ AA1: '7', AB1: '=AA1*3' }, 'AB1')).toBe('21');
  });
});
