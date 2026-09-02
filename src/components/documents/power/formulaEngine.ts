/**
 * Moteur de formules du tableur.
 *
 * POURQUOI IL EST ÉCRIT ICI PLUTÔT QU'IMPORTÉ
 * La version précédente s'appuyait sur HyperFormula, publiée sous GPL-3.0 — le
 * code déclarait d'ailleurs `licenseKey: 'gpl-v3'`, sans ambiguïté. Une
 * dépendance à réciprocité forte impose sa licence à l'ensemble du programme
 * qui la lie : le LICENSE MIT du dépôt et la mention « licence MIT » affichée
 * sur l'écran de connexion devenaient faux.
 *
 * Les remplaçants sous licence permissive ont été examinés. `fast-formula-parser`
 * est en MIT, mais tire `jstat`, dont le paquet ne déclare AUCUNE licence :
 * l'audit du dépôt l'aurait signalé comme non identifiée — c'est exactement le
 * problème que l'on venait de résoudre en retirant @qonto/embed-sdk. Échanger
 * une dette de licence contre une autre n'aurait rien réglé.
 *
 * Le périmètre réellement exercé par le tableur est modeste : arithmétique,
 * références, plages, comparaisons, et un jeu de fonctions courantes. Il tient
 * dans ce fichier, sans aucune dépendance, et la question de licence disparaît.
 *
 * CE QUI N'EST PAS COUVERT, ET C'EST ASSUMÉ
 * HyperFormula offrait ~400 fonctions ; il y en a ici une soixantaine. Les
 * fonctions financières avancées, les matrices et les dates Excel complètes
 * n'y sont pas. Une formule inconnue rend `#NOM?` — un refus visible, jamais
 * un résultat faux silencieux.
 */

export interface SheetLike {
  data: Record<string, { value?: string; formula?: string }>;
  rowCount: number;
  colCount: number;
}

/** Valeur qu'une expression peut produire. */
type Valeur = number | string | boolean | ErreurFormule;

class ErreurFormule {
  constructor(public readonly code: string) {}
}

const ERR_DIV0 = new ErreurFormule('#DIV/0!');
const ERR_VALEUR = new ErreurFormule('#VALEUR!');
const ERR_REF = new ErreurFormule('#REF!');
const ERR_NOM = new ErreurFormule('#NOM?');
const ERR_CYCLE = new ErreurFormule('#CYCLE!');
const ERR_NOMBRE = new ErreurFormule('#NOMBRE!');
const ERR_ARG = new ErreurFormule('#VALEUR!');

function estErreur(v: unknown): v is ErreurFormule {
  return v instanceof ErreurFormule;
}

// ─── références de cellules ────────────────────────────────────────────────

function colLabel(n: number): string {
  let s = '';
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function parseRef(ref: string): { r: number; c: number } | null {
  const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!m) return null;
  const lettres = m[1].toUpperCase();
  let c = 0;
  for (let i = 0; i < lettres.length; i++) c = c * 26 + lettres.charCodeAt(i) - 64;
  const r = parseInt(m[2], 10) - 1;
  if (r < 0) return null;
  return { r, c: c - 1 };
}

// ─── analyse lexicale ──────────────────────────────────────────────────────

type Jeton =
  | { t: 'nombre'; v: number }
  | { t: 'texte'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'nom'; v: string }
  | { t: 'op'; v: string }
  | { t: 'par'; v: '(' | ')' }
  | { t: 'sep' };

function decouper(src: string): Jeton[] | ErreurFormule {
  const jetons: Jeton[] = [];
  let i = 0;

  // QUEL CARACTÈRE SÉPARE LES ARGUMENTS ?
  //
  // Accepter la virgule ET le point-virgule à la fois paraissait accommodant.
  // C'était un piège pour un public francophone : `=SOMME(2,5;1)` était lu
  // comme trois arguments — 2, 5 et 1 — et rendait 8 au lieu de 3,5. La somme
  // était fausse, sans le moindre signe.
  //
  // Deux règles, qui lèvent l'ambiguïté sans dépendre de la locale du poste —
  // ce qui rend un classeur lisible à l'identique partout :
  //
  //  1. Si la formule contient un point-virgule, c'est LUI le séparateur, et la
  //     virgule est décimale partout.
  //  2. Sinon, la virgule ne sépare qu'À L'INTÉRIEUR d'un appel de fonction.
  //     Ailleurs elle est décimale : `=1,5+1` vaut 2,5, et non une erreur.
  //
  // Sans la seconde règle, `=1,5+1` était découpé en « 1 », « , », « 5+1 » et
  // rendait #VALEUR!.
  const pointVirgule = src.includes(';');
  let profondeurAppel = 0;
  const pilesAppel: boolean[] = [];
  while (i < src.length) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }

    if (ch === '"') {
      let s = '';
      i++;
      while (i < src.length) {
        if (src[i] === '"') {
          // Deux guillemets consécutifs valent un guillemet littéral.
          if (src[i + 1] === '"') { s += '"'; i += 2; continue; }
          break;
        }
        s += src[i++];
      }
      if (i >= src.length) return ERR_VALEUR; // guillemet non fermé
      i++;
      jetons.push({ t: 'texte', v: s });
      continue;
    }

    // La virgule est décimale sauf là où elle sépare réellement des arguments.
    const virguleDecimale = pointVirgule || profondeurAppel === 0;
    const debutNombre = /[0-9]/.test(ch)
      || ((ch === '.' || (ch === ',' && virguleDecimale)) && /[0-9]/.test(src[i + 1] ?? ''));
    if (debutNombre) {
      let s = '';
      while (i < src.length && (/[0-9.]/.test(src[i]) || (virguleDecimale && src[i] === ','))) {
        s += src[i] === ',' ? '.' : src[i];
        i++;
      }
      // Notation exponentielle : 1E-10, 2.5e3.
      if (/[eE]/.test(src[i] ?? '') && /[0-9+-]/.test(src[i + 1] ?? '')) {
        s += src[i++];
        if (/[+-]/.test(src[i])) s += src[i++];
        while (i < src.length && /[0-9]/.test(src[i])) s += src[i++];
      }
      const n = Number(s);
      if (!isFinite(n)) return ERR_VALEUR;
      jetons.push({ t: 'nombre', v: n });
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let s = '';
      while (i < src.length && /[A-Za-z0-9_.$]/.test(src[i])) s += src[i++];
      // Une plage s'écrit A1:B2 — le deux-points appartient à la référence.
      if (src[i] === ':' && /^\$?[A-Za-z]+\$?[0-9]+$/.test(s)) {
        let s2 = '';
        let j = i + 1;
        while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) s2 += src[j++];
        if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(s2)) {
          jetons.push({ t: 'ref', v: `${s.toUpperCase()}:${s2.toUpperCase()}` });
          i = j;
          continue;
        }
      }
      const maj = s.toUpperCase();
      if (maj === 'TRUE' || maj === 'VRAI') { jetons.push({ t: 'nom', v: 'TRUE' }); continue; }
      if (maj === 'FALSE' || maj === 'FAUX') { jetons.push({ t: 'nom', v: 'FALSE' }); continue; }
      if (/^\$?[A-Z]+\$?[0-9]+$/i.test(s)) jetons.push({ t: 'ref', v: maj });
      else jetons.push({ t: 'nom', v: maj });
      continue;
    }

    if (ch === '(') {
      // Une parenthèse est un APPEL si elle suit immédiatement un nom de
      // fonction ; sinon c'est un simple groupement, où la virgule reste
      // décimale.
      const precedent = jetons[jetons.length - 1];
      const estAppel = precedent?.t === 'nom';
      pilesAppel.push(estAppel);
      if (estAppel) profondeurAppel++;
      jetons.push({ t: 'par', v: ch });
      i++;
      continue;
    }
    if (ch === ')') {
      if (pilesAppel.pop() === true) profondeurAppel--;
      jetons.push({ t: 'par', v: ch });
      i++;
      continue;
    }
    if (ch === ';' || (ch === ',' && !virguleDecimale)) {
      jetons.push({ t: 'sep' });
      i++;
      continue;
    }

    const deux = src.slice(i, i + 2);
    if (deux === '<=' || deux === '>=' || deux === '<>') {
      jetons.push({ t: 'op', v: deux }); i += 2; continue;
    }
    if ('+-*/^&<>='.includes(ch)) { jetons.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '%') { jetons.push({ t: 'op', v: '%' }); i++; continue; }

    return ERR_VALEUR; // caractère inattendu
  }
  return jetons;
}

// ─── analyse syntaxique ────────────────────────────────────────────────────

type Noeud =
  | { n: 'litt'; v: Valeur }
  | { n: 'ref'; v: string }
  | { n: 'plage'; v: string }
  | { n: 'appel'; nom: string; args: Noeud[] }
  | { n: 'bin'; op: string; g: Noeud; d: Noeud }
  | { n: 'neg'; e: Noeud }
  | { n: 'pct'; e: Noeud };

/** Précédence, du plus faible au plus fort. Excel place `&` entre comparaison et addition. */
const PRECEDENCE: Record<string, number> = {
  '=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '<>': 1,
  '&': 2,
  '+': 3, '-': 3,
  '*': 4, '/': 4,
  '^': 5,
};

class Analyseur {
  private i = 0;
  constructor(private readonly j: Jeton[]) {}

  analyser(): Noeud | ErreurFormule {
    const e = this.expression(0);
    if (estErreur(e)) return e;
    if (this.i < this.j.length) return ERR_VALEUR; // jetons en trop
    return e;
  }

  private expression(min: number): Noeud | ErreurFormule {
    let g = this.unaire();
    if (estErreur(g)) return g;
    for (;;) {
      const t = this.j[this.i];
      if (!t || t.t !== 'op' || t.v === '%') break;
      const p = PRECEDENCE[t.v];
      if (p === undefined || p < min) break;
      this.i++;
      // Excel évalue les opérateurs de même précédence de GAUCHE à droite,
      // `^` compris : `=2^3^2` y vaut 64, non 512. La spécification OpenFormula
      // d'OpenDocument dit la même chose, et LibreOffice Calc s'y conforme.
      // L'écart n'est pas théorique : sur `=1000*1,05^2^3`, un intérêt composé
      // rendait 1477,46 au lieu de 1340,10 — 10 % d'erreur, sans aucun signe.
      const d = this.expression(p + 1);
      if (estErreur(d)) return d;
      g = { n: 'bin', op: t.v, g, d };
    }
    return g;
  }

  private unaire(): Noeud | ErreurFormule {
    const t = this.j[this.i];
    if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.i++;
      const e = this.unaire();
      if (estErreur(e)) return e;
      return t.v === '-' ? { n: 'neg', e } : e;
    }
    return this.postfixe();
  }

  private postfixe(): Noeud | ErreurFormule {
    let e = this.primaire();
    if (estErreur(e)) return e;
    while (this.j[this.i]?.t === 'op' && (this.j[this.i] as { v: string }).v === '%') {
      this.i++;
      e = { n: 'pct', e };
    }
    return e;
  }

  private primaire(): Noeud | ErreurFormule {
    const t = this.j[this.i];
    if (!t) return ERR_VALEUR;

    if (t.t === 'nombre') { this.i++; return { n: 'litt', v: t.v }; }
    if (t.t === 'texte') { this.i++; return { n: 'litt', v: t.v }; }

    if (t.t === 'ref') {
      this.i++;
      return t.v.includes(':') ? { n: 'plage', v: t.v } : { n: 'ref', v: t.v };
    }

    if (t.t === 'nom') {
      this.i++;
      if (t.v === 'TRUE') return { n: 'litt', v: true };
      if (t.v === 'FALSE') return { n: 'litt', v: false };
      if (this.j[this.i]?.t === 'par' && (this.j[this.i] as { v: string }).v === '(') {
        this.i++;
        const args: Noeud[] = [];
        if (this.j[this.i]?.t === 'par' && (this.j[this.i] as { v: string }).v === ')') {
          this.i++;
          return { n: 'appel', nom: t.v, args };
        }
        for (;;) {
          const a = this.expression(0);
          if (estErreur(a)) return a;
          args.push(a);
          const s = this.j[this.i];
          if (s?.t === 'sep') { this.i++; continue; }
          if (s?.t === 'par' && s.v === ')') { this.i++; break; }
          return ERR_VALEUR;
        }
        return { n: 'appel', nom: t.v, args };
      }
      return ERR_NOM; // un nom seul n'est pas une valeur connue
    }

    if (t.t === 'par' && t.v === '(') {
      this.i++;
      const e = this.expression(0);
      if (estErreur(e)) return e;
      const f = this.j[this.i];
      if (!(f?.t === 'par' && f.v === ')')) return ERR_VALEUR;
      this.i++;
      return e;
    }

    return ERR_VALEUR;
  }
}

// ─── conversions ───────────────────────────────────────────────────────────

/**
 * Un texte n'est un nombre que s'il en a EXACTEMENT la forme décimale.
 *
 * `Number()` accepte bien davantage : « 0x1A » vaut 26, « 0b101 » vaut 5,
 * « 0o17 » vaut 15, « Infinity » vaut l'infini. Une colonne de références
 * produit — « 0x1A », « 0042 » — était donc silencieusement additionnée comme
 * des nombres. Mesuré : une somme de références rendait 73.
 */
const FORME_NOMBRE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

function texteEnNombre(s: string): number | null {
  const t = s.trim();
  if (t === '' || !FORME_NOMBRE.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function versNombre(v: Valeur): number | ErreurFormule {
  if (estErreur(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const t = v.trim();
  // Une cellule vide vaut zéro dans un calcul, comme dans Excel.
  if (t === '') return 0;
  const n = texteEnNombre(t);
  return n === null ? ERR_VALEUR : n;
}

function versTexte(v: Valeur): string {
  if (estErreur(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return formaterNombre(v);
  return v;
}

function versBooleen(v: Valeur): boolean | ErreurFormule {
  if (estErreur(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = v.trim().toUpperCase();
  if (s === 'TRUE' || s === 'VRAI') return true;
  if (s === 'FALSE' || s === 'FAUX' || s === '') return false;
  return ERR_VALEUR;
}

function formaterNombre(n: number): string {
  if (!Number.isFinite(n)) return '#NOMBRE!';
  if (Number.isInteger(n)) return String(n);
  // `toFixed(12)` écrasait tout ce qui est sous 5e-13 : trois cellules valant
  // 1e-13 chacune s'affichaient « 0 » ET leur somme aussi, pendant que
  // `=SOMME(...)=0` répondait FAUX. Un total contredisait ses propres lignes.
  //
  // On n'arrondit donc QUE dans la plage où l'artefact de virgule flottante
  // est réel — au-delà de 1e-9 en valeur absolue — et on rend la valeur telle
  // quelle en dessous.
  if (Math.abs(n) < 1e-9) return String(n);
  const arrondi = Number(n.toPrecision(15));
  return String(arrondi);
}

// ─── bibliothèque de fonctions ─────────────────────────────────────────────

/** Aplatit les arguments, en écartant les vides — comme le fait SUM d'Excel. */
function nombres(args: Valeur[][]): number[] | ErreurFormule {
  const out: number[] = [];
  for (const groupe of args) {
    for (const v of groupe) {
      if (estErreur(v)) return v;
      if (v === '' || v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      const n = versNombre(v);
      if (estErreur(n)) continue; // le texte non numérique est ignoré, comme dans Excel
      out.push(n);
    }
  }
  return out;
}

function toutes(args: Valeur[][]): Valeur[] {
  return args.flat();
}

type Fonction = (args: Valeur[][]) => Valeur;

const FONCTIONS: Record<string, Fonction> = {
  SUM: (a) => { const n = nombres(a); return estErreur(n) ? n : n.reduce((s, x) => s + x, 0); },
  SOMME: (a) => FONCTIONS.SUM(a),
  AVERAGE: (a) => {
    const n = nombres(a);
    if (estErreur(n)) return n;
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : ERR_DIV0;
  },
  MOYENNE: (a) => FONCTIONS.AVERAGE(a),
  MIN: (a) => {
    if (!a.length) return ERR_ARG;
    const n = nombres(a);
    return estErreur(n) ? n : (n.length ? Math.min(...n) : 0);
  },
  MAX: (a) => {
    if (!a.length) return ERR_ARG;
    const n = nombres(a);
    return estErreur(n) ? n : (n.length ? Math.max(...n) : 0);
  },
  COUNT: (a) => { const n = nombres(a); return estErreur(n) ? n : n.length; },
  NB: (a) => FONCTIONS.COUNT(a),
  COUNTA: (a) => toutes(a).filter((v) => !(v === '' || v === null || v === undefined)).length,
  NBVAL: (a) => FONCTIONS.COUNTA(a),
  COUNTBLANK: (a) => toutes(a).filter((v) => v === '' || v === null || v === undefined).length,
  PRODUCT: (a) => { const n = nombres(a); return estErreur(n) ? n : n.reduce((s, x) => s * x, 1); },
  MEDIAN: (a) => {
    const n = nombres(a);
    if (estErreur(n)) return n;
    if (!n.length) return ERR_DIV0;
    const t = [...n].sort((x, y) => x - y);
    const m = Math.floor(t.length / 2);
    return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
  },
  STDEV: (a) => {
    const n = nombres(a);
    if (estErreur(n)) return n;
    if (n.length < 2) return ERR_DIV0;
    const moy = n.reduce((s, x) => s + x, 0) / n.length;
    return Math.sqrt(n.reduce((s, x) => s + (x - moy) ** 2, 0) / (n.length - 1));
  },
  VAR: (a) => {
    const n = nombres(a);
    if (estErreur(n)) return n;
    if (n.length < 2) return ERR_DIV0;
    const moy = n.reduce((s, x) => s + x, 0) / n.length;
    return n.reduce((s, x) => s + (x - moy) ** 2, 0) / (n.length - 1);
  },

  ABS: (a) => un(a, Math.abs),
  SQRT: (a) => un(a, (x) => (x < 0 ? NaN : Math.sqrt(x))),
  RACINE: (a) => FONCTIONS.SQRT(a),
  EXP: (a) => un(a, Math.exp),
  LN: (a) => un(a, (x) => (x <= 0 ? NaN : Math.log(x))),
  LOG10: (a) => un(a, (x) => (x <= 0 ? NaN : Math.log10(x))),
  SIGN: (a) => un(a, Math.sign),
  INT: (a) => un(a, Math.floor),
  ENT: (a) => FONCTIONS.INT(a),
  SIN: (a) => un(a, Math.sin),
  COS: (a) => un(a, Math.cos),
  TAN: (a) => un(a, Math.tan),
  PI: () => Math.PI,
  // Excel arrondit les demis À L'ÉCART DE ZÉRO : ROUND(2,5)=3 ET ROUND(-2,5)=-3.
  // `Math.round` de JavaScript arrondit vers le haut, donc -2 pour -2,5 : le
  // moteur brisait la symétrie sur les montants négatifs. On corrige aussi la
  // représentation binaire au passage — ROUND(1,005;2) rendait 1 au lieu de
  // 1,01, parce que 1,005 vaut en réalité 1,00499999… en virgule flottante.
  ROUND: (a) => deux(a, (x, d) => arrondiExcel(x, d)),
  ARRONDI: (a) => FONCTIONS.ROUND(a),
  ROUNDUP: (a) => deux(a, (x, d) => {
    const f = 10 ** Math.trunc(d);
    return (x < 0 ? -1 : 1) * Math.ceil(Math.abs(x) * f) / f;
  }),
  ROUNDDOWN: (a) => deux(a, (x, d) => {
    const f = 10 ** Math.trunc(d);
    return (x < 0 ? -1 : 1) * Math.floor(Math.abs(x) * f) / f;
  }),
  // Le pas vaut 1 par défaut : appelées à un seul argument, ces deux fonctions
  // rendaient 0 — `=CEILING(1,4)` valait 0, ce qu'aucun utilisateur ne peut
  // deviner.
  CEILING: (a) => deuxDefaut(a, 1, (x, s) => (s === 0 ? 0 : Math.ceil(x / s) * s)),
  FLOOR: (a) => deuxDefaut(a, 1, (x, s) => (s === 0 ? 0 : Math.floor(x / s) * s)),
  MOD: (a) => deux(a, (x, y) => (y === 0 ? NaN : x - y * Math.floor(x / y))),
  POWER: (a) => deux(a, (x, y) => x ** y),
  PUISSANCE: (a) => FONCTIONS.POWER(a),

  IF: (a) => {
    const c = versBooleen(premier(a[0]));
    if (estErreur(c)) return c;
    if (c) return a[1] ? premier(a[1]) : true;
    return a[2] ? premier(a[2]) : false;
  },
  SI: (a) => FONCTIONS.IF(a),
  IFERROR: (a) => {
    const v = premier(a[0]);
    return estErreur(v) ? (a[1] ? premier(a[1]) : '') : v;
  },
  SIERREUR: (a) => FONCTIONS.IFERROR(a),
  AND: (a) => {
    for (const v of toutes(a)) {
      const b = versBooleen(v);
      if (estErreur(b)) return b;
      if (!b) return false;
    }
    return true;
  },
  ET: (a) => FONCTIONS.AND(a),
  OR: (a) => {
    for (const v of toutes(a)) {
      const b = versBooleen(v);
      if (estErreur(b)) return b;
      if (b) return true;
    }
    return false;
  },
  OU: (a) => FONCTIONS.OR(a),
  NOT: (a) => { const b = versBooleen(premier(a[0])); return estErreur(b) ? b : !b; },
  NON: (a) => FONCTIONS.NOT(a),
  TRUE: () => true,
  FALSE: () => false,
  ISBLANK: (a) => { const v = premier(a[0]); return v === '' || v === null || v === undefined; },
  ISNUMBER: (a) => typeof premier(a[0]) === 'number',
  ISTEXT: (a) => typeof premier(a[0]) === 'string',
  ISERROR: (a) => estErreur(premier(a[0])),

  CONCATENATE: (a) => toutes(a).map(versTexte).join(''),
  CONCAT: (a) => FONCTIONS.CONCATENATE(a),
  LEN: (a) => versTexte(premier(a[0])).length,
  NBCAR: (a) => FONCTIONS.LEN(a),
  UPPER: (a) => versTexte(premier(a[0])).toUpperCase(),
  MAJUSCULE: (a) => FONCTIONS.UPPER(a),
  LOWER: (a) => versTexte(premier(a[0])).toLowerCase(),
  MINUSCULE: (a) => FONCTIONS.LOWER(a),
  TRIM: (a) => versTexte(premier(a[0])).trim().replace(/\s+/g, ' '),
  LEFT: (a) => {
    const s = versTexte(premier(a[0]));
    const n = a[1] ? versNombre(premier(a[1])) : 1;
    return estErreur(n) ? n : s.slice(0, Math.max(0, Math.trunc(n)));
  },
  RIGHT: (a) => {
    const s = versTexte(premier(a[0]));
    const n = a[1] ? versNombre(premier(a[1])) : 1;
    if (estErreur(n)) return n;
    const k = Math.max(0, Math.trunc(n));
    return k === 0 ? '' : s.slice(-k);
  },
  MID: (a) => {
    const s = versTexte(premier(a[0]));
    const d = versNombre(premier(a[1]));
    const n = versNombre(premier(a[2]));
    if (estErreur(d)) return d;
    if (estErreur(n)) return n;
    // Excel refuse un indice de départ inférieur à 1 ; le moteur le ramenait
    // silencieusement à 1, si bien que `=MID("abc";0;2)` et `=MID("abc";-5;2)`
    // rendaient tous deux « ab » — une chaîne décalée, sans erreur.
    if (Math.trunc(d) < 1) return ERR_ARG;
    if (Math.trunc(n) < 0) return ERR_ARG;
    const debut = Math.trunc(d) - 1;
    return s.slice(debut, debut + Math.trunc(n));
  },
  SUBSTITUTE: (a) => {
    const s = versTexte(premier(a[0]));
    const de = versTexte(premier(a[1]));
    const vers = a[2] ? versTexte(premier(a[2])) : '';
    if (de === '') return s;
    // Le quatrième argument désigne l'occurrence à remplacer, et lui seul.
    // Il était ignoré : `=SUBSTITUTE("2026-01-01";"-";"/";1)` remplaçait LES
    // DEUX tirets. Une date reformatée devenait fausse sans alerte.
    if (a[3]) {
      const rang = versNombre(premier(a[3]));
      if (estErreur(rang)) return rang;
      const k = Math.trunc(rang);
      if (k < 1) return ERR_ARG;
      let pos = -1;
      for (let n = 0; n < k; n++) {
        pos = s.indexOf(de, pos + 1);
        if (pos === -1) return s;
      }
      return s.slice(0, pos) + vers + s.slice(pos + de.length);
    }
    return s.split(de).join(vers);
  },
  // TEXT acceptait un format et le jetait : `=TEXT(0,5;"0.00%")` rendait
  // « 0.5 ». Une fonction qui accepte un argument sans l'honorer est pire
  // qu'une fonction absente — elle donne l'illusion d'avoir formaté. Tant que
  // les motifs de format ne sont pas implémentés, l'appel avec format est
  // REFUSÉ ; sans format, la conversion en texte reste rendue.
  TEXT: (a) => {
    if (a.length > 1 && versTexte(premier(a[1])) !== '') return ERR_NOM;
    return versTexte(premier(a[0]));
  },
  VALUE: (a) => versNombre(premier(a[0])),
};

function premier(groupe: Valeur[] | undefined): Valeur {
  if (!groupe || groupe.length === 0) return '';
  return groupe[0];
}

function un(args: Valeur[][], f: (x: number) => number): Valeur {
  const n = versNombre(premier(args[0]));
  if (estErreur(n)) return n;
  const r = f(n);
  return isNaN(r) ? ERR_VALEUR : r;
}

/** Arrondi d'Excel : à l'écart de zéro, sur la valeur décimale affichée. */
function arrondiExcel(x: number, decimales: number): number {
  const d = Math.trunc(decimales);
  const f = 10 ** d;
  // Passer par la représentation décimale évite que 1,005 — qui vaut
  // 1,00499999999999989 en binaire — s'arrondisse vers le bas.
  const mis = Number((Math.abs(x) * f).toPrecision(15));
  return (x < 0 ? -1 : 1) * Math.round(mis) / f;
}

function deuxDefaut(
  args: Valeur[][], defaut: number, f: (x: number, y: number) => number,
): Valeur {
  const x = versNombre(premier(args[0]));
  if (estErreur(x)) return x;
  const y = args.length > 1 ? versNombre(premier(args[1])) : defaut;
  if (estErreur(y)) return y;
  const r = f(x, y);
  return Number.isFinite(r) ? r : (Number.isNaN(r) ? ERR_VALEUR : ERR_NOMBRE);
}

function deux(args: Valeur[][], f: (x: number, y: number) => number): Valeur {
  const x = versNombre(premier(args[0]));
  if (estErreur(x)) return x;
  const y = args[1] ? versNombre(premier(args[1])) : 0;
  if (estErreur(y)) return y;
  const r = f(x, y);
  if (!isFinite(r)) return isNaN(r) ? ERR_VALEUR : ERR_DIV0;
  return r;
}

/** Noms reconnus, pour l'autocomplétion de l'éditeur. */
export function listFunctions(): string[] {
  return Object.keys(FONCTIONS).sort();
}

/**
 * Un dépassement de capacité doit devenir une ERREUR, pas un infini.
 *
 * `=1E200*1E200` rendait « #DIV/0! » à l'affichage tout en restant le nombre
 * Infinity dans les calculs : `IFERROR` ne le rattrapait pas, `ISERROR` disait
 * FAUX, et `=1/(1E200*1E200)` rendait tranquillement 0.
 */
function borner(n: number): Valeur {
  if (Number.isNaN(n)) return ERR_VALEUR;
  if (!Number.isFinite(n)) return ERR_NOMBRE;
  return n;
}

/**
 * Ordre de comparaison d'Excel, qui n'est pas celui de JavaScript.
 *
 * Trois règles, chacune corrigeant un résultat faux mesuré :
 *
 *  1. Les TYPES sont ordonnés : nombre < texte < booléen. Un nombre n'est donc
 *     jamais égal au texte qui lui ressemble — `=1="1"` rend FAUX, là où le
 *     moteur rendait VRAI. Et un texte numérique ne se compare pas comme un
 *     nombre : avec A1=5 (nombre) et B1="+50" (texte), `=A1>B1` rendait VRAI,
 *     soit « 5 est supérieur à 50 ».
 *  2. Une cellule VIDE prend le type de ce à quoi on la compare : `=A1=0` rend
 *     VRAI sur une cellule vide, `=A1=""` aussi. Le moteur rendait FAUX aux
 *     deux, et `=IF(A1>=0,…)` déclarait négative une cellule sans contenu.
 *  3. Le texte se compare sans tenir compte de la casse, comme dans Excel.
 */
function rang(v: Valeur): number {
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return 1;
  return 2; // booléen
}

function comparer(g: Valeur, d: Valeur): number {
  // Le vide prend le type de l'autre opérande.
  const gv = g === '' ? (typeof d === 'number' ? 0 : (typeof d === 'boolean' ? false : '')) : g;
  const dv = d === '' ? (typeof g === 'number' ? 0 : (typeof g === 'boolean' ? false : '')) : d;

  const rg = rang(gv);
  const rd = rang(dv);
  if (rg !== rd) return rg < rd ? -1 : 1;

  if (rg === 0) {
    const a = gv as number;
    const b = dv as number;
    return a === b ? 0 : (a < b ? -1 : 1);
  }
  if (rg === 2) {
    const a = gv as boolean;
    const b = dv as boolean;
    return a === b ? 0 : (a ? 1 : -1);
  }
  const a = String(gv).toLowerCase();
  const b = String(dv).toLowerCase();
  return a === b ? 0 : (a < b ? -1 : 1);
}

// ─── évaluation ────────────────────────────────────────────────────────────

/**
 * Une instance par tableur ouvert.
 *
 * L'isolation n'est pas cosmétique : un moteur partagé entre deux tableurs
 * mêlait leurs cellules — c'était déjà le motif de la version précédente, et
 * la remarque vaut toujours.
 */
export class FormulaEngine {
  /** Cellules en cours d'évaluation, pour couper les cycles. */
  private enCours = new Set<string>();

  /**
   * Mémoire d'UN SEUL appel : elle évite de recalculer dix fois la même
   * cellule dans une formule qui la référence plusieurs fois, et disparaît
   * ensuite.
   */
  private memo = new Map<string, Valeur>();

  /**
   * IL N'Y A PLUS DE CACHE ENTRE LES APPELS, ET C'EST DÉLIBÉRÉ.
   *
   * La version précédente mémorisait les résultats dans un WeakMap indexé par
   * la RÉFÉRENCE de `sheet.data`. Or l'éditeur modifie les cellules en place :
   * la référence ne change pas, le cache n'était donc jamais invalidé.
   *
   * Mesuré : `data.A1.value = '10'` puis évaluation de `B1` (`=A1*2`) rend 20 ;
   * on écrit `data.A1.value = '50'` ; `B1` rend toujours 20 — définitivement.
   * Un tableur qui affiche un total périmé, sans le dire, est pire qu'un
   * tableur lent. Le cache indexait de surcroît par la clé telle qu'écrite :
   * `B1` et `b1` avaient deux entrées, et pouvaient diverger.
   *
   * Le coût est réel mais borné : une feuille se recalcule à chaque rendu.
   * Si cela devenait sensible, la bonne réponse serait une invalidation portée
   * par l'éditeur — un compteur de version incrémenté à chaque frappe — et non
   * un cache qui devine.
   */
  evaluateCell(sheet: SheetLike, cellKey: string): string {
    const p = parseRef(cellKey);
    if (!p) return ERR_REF.code;

    this.enCours.clear();
    this.memo.clear();
    const v = this.valeurCellule(sheet, cellKey.toUpperCase());
    this.memo.clear();
    return versTexte(v);
  }

  /** Valeur brute d'une cellule, formule évaluée si besoin. */
  private valeurCellule(sheet: SheetLike, ref: string): Valeur {
    const memorise = this.memo.get(ref);
    if (memorise !== undefined) return memorise;

    const cellule = sheet.data[ref] ?? sheet.data[ref.replace(/\$/g, '')];
    if (!cellule) return '';

    if (cellule.formula && cellule.formula.startsWith('=')) {
      // Une formule qui se référence, directement ou par une chaîne de
      // cellules, doit rendre une erreur — pas boucler jusqu'à épuisement de
      // la pile, ce qui fige l'onglet sans message.
      if (this.enCours.has(ref)) return ERR_CYCLE;
      this.enCours.add(ref);
      try {
        const v = this.evaluerExpression(sheet, cellule.formula.slice(1));
        this.memo.set(ref, v);
        return v;
      } finally {
        this.enCours.delete(ref);
      }
    }

    const brut = cellule.value ?? '';
    if (brut === '') return '';
    const n = Number(brut.trim());
    // Seul un texte qui est EXACTEMENT un nombre devient un nombre : sinon
    // « 1,5 » ou « 3 pommes » se transformeraient en valeurs numériques
    // inattendues dans les sommes.
    return isFinite(n) && brut.trim() !== '' && String(n) === brut.trim() ? n : brut;
  }

  private evaluerExpression(sheet: SheetLike, src: string): Valeur {
    const jetons = decouper(src);
    if (estErreur(jetons)) return jetons;
    const arbre = new Analyseur(jetons).analyser();
    if (estErreur(arbre)) return arbre;
    const v = this.evaluerNoeud(sheet, arbre);
    return Array.isArray(v) ? (v[0] ?? '') : v;
  }

  /** Rend une valeur, ou un tableau pour une plage. */
  private evaluerNoeud(sheet: SheetLike, n: Noeud): Valeur | Valeur[] {
    switch (n.n) {
      case 'litt':
        return n.v;

      case 'ref':
        return this.valeurCellule(sheet, n.v);

      case 'plage': {
        const [a, b] = n.v.split(':');
        const pa = parseRef(a);
        const pb = parseRef(b);
        if (!pa || !pb) return ERR_REF;
        const out: Valeur[] = [];
        const r1 = Math.min(pa.r, pb.r), r2 = Math.max(pa.r, pb.r);
        const c1 = Math.min(pa.c, pb.c), c2 = Math.max(pa.c, pb.c);
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            out.push(this.valeurCellule(sheet, `${colLabel(c)}${r + 1}`));
          }
        }
        return out;
      }

      case 'neg': {
        const v = this.aplatir(this.evaluerNoeud(sheet, n.e));
        const x = versNombre(v);
        return estErreur(x) ? x : -x;
      }

      case 'pct': {
        const v = this.aplatir(this.evaluerNoeud(sheet, n.e));
        const x = versNombre(v);
        return estErreur(x) ? x : x / 100;
      }

      case 'appel': {
        const f = FONCTIONS[n.nom];
        if (!f) return ERR_NOM;
        const args: Valeur[][] = [];
        for (const a of n.args) {
          const v = this.evaluerNoeud(sheet, a);
          args.push(Array.isArray(v) ? v : [v]);
        }
        // Une erreur dans un argument se propage, SAUF pour les fonctions dont
        // le rôle est justement de la traiter.
        if (n.nom !== 'IFERROR' && n.nom !== 'SIERREUR' && n.nom !== 'ISERROR') {
          for (const groupe of args) {
            for (const v of groupe) if (estErreur(v)) return v;
          }
        }
        return f(args);
      }

      case 'bin': {
        const g = this.aplatir(this.evaluerNoeud(sheet, n.g));
        if (estErreur(g)) return g;
        const d = this.aplatir(this.evaluerNoeud(sheet, n.d));
        if (estErreur(d)) return d;
        return this.appliquerBinaire(n.op, g, d);
      }
    }
  }

  private aplatir(v: Valeur | Valeur[]): Valeur {
    return Array.isArray(v) ? (v[0] ?? '') : v;
  }

  private appliquerBinaire(op: string, g: Valeur, d: Valeur): Valeur {
    if (op === '&') return versTexte(g) + versTexte(d);

    const COMPARAISONS = ['=', '<>', '<', '>', '<=', '>='];
    if (COMPARAISONS.includes(op)) {
      const cmp = comparer(g, d);
      switch (op) {
        case '=': return cmp === 0;
        case '<>': return cmp !== 0;
        case '<': return cmp < 0;
        case '>': return cmp > 0;
        case '<=': return cmp <= 0;
        case '>=': return cmp >= 0;
      }
    }

    const x = versNombre(g);
    if (estErreur(x)) return x;
    const y = versNombre(d);
    if (estErreur(y)) return y;

    switch (op) {
      case '+': return borner(x + y);
      case '-': return borner(x - y);
      case '*': return borner(x * y);
      case '/': return y === 0 ? ERR_DIV0 : borner(x / y);
      case '^': {
        const r = x ** y;
        return Number.isNaN(r) ? ERR_VALEUR : borner(r);
      }
    }
    return ERR_VALEUR;
  }

  destroy(): void {
    this.enCours.clear();
    this.memo.clear();
  }
}

// ─── compatibilité des appelants existants ─────────────────────────────────

let moteurPartage: FormulaEngine | null = null;
function partage(): FormulaEngine {
  if (!moteurPartage) moteurPartage = new FormulaEngine();
  return moteurPartage;
}

/** @deprecated Instanciez `new FormulaEngine()` par éditeur. */
export function syncSheet(_sheet: SheetLike): void {
  // sans objet : l'évaluation est à la demande.
}

/** @deprecated Idem. */
export function flushSync(sheet: SheetLike): void {
  partage().evaluateCell(sheet, 'A1');
}

export function evaluateCell(sheet: SheetLike, cellKey: string): string {
  return partage().evaluateCell(sheet, cellKey);
}
