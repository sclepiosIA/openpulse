/**
 * Décider si un fichier est du texte — règle unique, partagée.
 *
 * POURQUOI CE MODULE EXISTE
 * `scan.mjs` et `extract.mjs` portaient chacun leur propre liste blanche
 * d'extensions à traiter. Deux listes, tenues séparément, qui ont divergé : la
 * barrière connaissait `entitlements` et `plist`, l'extraction connaissait en
 * plus `java`, `kt`, `swift`, `pbxproj`. Aucune des deux ne connaissait les
 * `Dockerfile.<suffixe>`.
 *
 * Conséquence mesurée avant correction : `docker/Dockerfile.backend` et
 * `docker/Dockerfile.frontend` portaient le nom de l'éditeur d'origine en clair,
 * ligne 2. L'extraction ne les réécrivait pas, et la barrière ne les lisait pas
 * — elle annonçait « 0 constat bloquant » sur un arbre qu'elle n'avait pas
 * entièrement lu. 211 fichiers suivis par git y échappaient, dont 28 de texte.
 *
 * LE SENS EST INVERSÉ, ET C'EST LE POINT
 * Une liste blanche d'extensions est fausse par construction : elle ne couvre
 * que ce que son auteur avait en tête, et tout type non prévu passe en silence.
 * On nomme donc ce qu'on ne sait PAS lire — les binaires — et on traite tout le
 * reste. Un type inconnu est analysé par défaut : au pire il produit un constat
 * à arbitrer, jamais un silence.
 *
 * La détection de contenu ferme le dernier trou : un binaire dont l'extension
 * n'est pas listée est reconnu à son contenu, comme le fait git lui-même.
 */

import { openSync, readSync, closeSync } from 'node:fs'

/**
 * Extensions binaires connues. Cette liste peut être incomplète sans danger :
 * ce qu'elle oublie est rattrapé par `contenuBinaire()`. C'est l'inverse d'une
 * liste blanche, dont chaque oubli crée un angle mort.
 */
export const EXT_BINAIRES = new Set([
  // images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'icns', 'bmp', 'tif', 'tiff', 'avif', 'heic',
  'psd', 'ai', 'sketch', 'fig', 'xcf',
  // polices
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // archives et paquets
  'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'tar', 'jar', 'war', 'apk', 'aab',
  'ipa', 'dmg', 'pkg', 'deb', 'rpm', 'msi', 'crx', 'xpi', 'whl', 'egg',
  // binaires exécutables et objets
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'obj', 'lib', 'node', 'wasm', 'class', 'pyc', 'pyo',
  // média
  'mp3', 'mp4', 'wav', 'ogg', 'oga', 'ogv', 'webm', 'avi', 'mov', 'mkv', 'flac', 'aac', 'm4a', 'm4v',
  // documents composés (des archives zip déguisées)
  'pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'doc', 'xls', 'ppt',
  // bases et magasins de clés
  'db', 'sqlite', 'sqlite3', 'mdb', 'keystore', 'jks', 'p12', 'pfx', 'der',
])

/**
 * Un octet nul dans les 8 premiers kilo-octets : c'est le critère que git
 * emploie pour déclarer un fichier binaire, et il ne se rencontre pas dans du
 * texte. Un fichier illisible est réputé texte — mieux vaut un constat de plus
 * qu'un fichier passé sous silence.
 */
export function contenuBinaire(cheminAbsolu) {
  let fd
  try {
    fd = openSync(cheminAbsolu, 'r')
    const tampon = Buffer.alloc(8192)
    const lus = readSync(fd, tampon, 0, 8192, 0)
    return tampon.subarray(0, lus).includes(0)
  } catch {
    return false
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd) } catch { /* déjà fermé */ }
    }
  }
}

/**
 * La question que se posent les deux outils : faut-il lire ce fichier ?
 * `nom` sert à l'extension, `cheminAbsolu` au contenu.
 */
export function estTexte(nom, cheminAbsolu) {
  const ext = nom.includes('.') ? nom.split('.').pop().toLowerCase() : ''
  if (EXT_BINAIRES.has(ext)) return false
  return !contenuBinaire(cheminAbsolu)
}
