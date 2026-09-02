import { describe, it, expect } from 'vitest';
import { commercialImportPayload } from './commercial-import-payload';

/**
 * Garde-fou de distribution OpenPulse.
 *
 * Les jeux de démonstration livrés publiquement ne doivent contenir que des domaines
 * réservés à la documentation et aux tests (RFC 2606 / RFC 6761). Ce test est le point
 * d'application de la règle : si quelqu'un réintroduit un domaine réel dans une fixture,
 * la suite de tests échoue avant la publication, au lieu de laisser fuiter une adresse
 * de messagerie appartenant à une organisation tierce.
 */
const SUFFIXES_RESERVES: readonly string[] = [
  '.example.org',
  '.example.com',
  '.example.net',
  '.test',
  '.invalid',
  '.localhost',
];

const DOMAINES_RESERVES_NUS: readonly string[] = ['example.org', 'example.com', 'example.net'];

function domaineDe(adresse: string): string {
  const separateur = adresse.lastIndexOf('@');
  return separateur === -1 ? '' : adresse.slice(separateur + 1).toLowerCase();
}

function estReserve(domaine: string): boolean {
  if (DOMAINES_RESERVES_NUS.includes(domaine)) {
    return true;
  }
  return SUFFIXES_RESERVES.some(suffixe => domaine.endsWith(suffixe));
}

function toutesLesAdresses(): string[] {
  return [
    ...commercialImportPayload.etablissements.flatMap(item => item.contacts),
    ...commercialImportPayload.partenaires.flatMap(item => item.contacts),
  ].map(contact => contact.email);
}

describe('fixtures — domaines réservés uniquement', () => {
  it('collecte effectivement des adresses à contrôler', () => {
    // Sans cette garde, un payload vidé ferait passer le test suivant à vide.
    expect(toutesLesAdresses().length).toBeGreaterThan(0);
  });

  it("n'utilise que des domaines réservés dans le payload d'import commercial", () => {
    const horsPerimetre = toutesLesAdresses().filter(adresse => !estReserve(domaineDe(adresse)));

    expect(horsPerimetre).toEqual([]);
  });

  it('ne laisse aucune adresse sans domaine', () => {
    const sansDomaine = toutesLesAdresses().filter(adresse => domaineDe(adresse).length === 0);

    expect(sansDomaine).toEqual([]);
  });
});
