import { getApporteurAbbreviation } from './apporteurAbbreviation'

describe('getApporteurAbbreviation', () => {
  it('retourne ? pour une chaîne vide', () => {
    expect(getApporteurAbbreviation('')).toBe('?')
  })

  it('retourne ? pour une valeur falsy', () => {
    expect(getApporteurAbbreviation('')).toBe('?')
  })

  it('utilise le mapping explicite pour les cas connus', () => {
    expect(getApporteurAbbreviation('Softway Médical')).toBe('SWM')
    expect(getApporteurAbbreviation('Softway Medical')).toBe('SWM')
    expect(getApporteurAbbreviation('MedTech Advisors')).toBe('MTA')
    expect(getApporteurAbbreviation('Groupe Hippocrate')).toBe('GH')
  })

  it('gère les espaces autour des valeurs connues', () => {
    expect(getApporteurAbbreviation('  Softway Médical  ')).toBe('SWM')
    expect(getApporteurAbbreviation('   Groupe Hippocrate')).toBe('GH')
  })

  it('calcule les initiales pour les noms inconnus multi-mots', () => {
    expect(getApporteurAbbreviation('Alpha Beta')).toBe('AB')
    expect(getApporteurAbbreviation('Alpha Beta Gamma')).toBe('ABG')
    expect(getApporteurAbbreviation('Alpha Beta Gamma Delta')).toBe('ABG')
  })

  it('ignore les espaces multiples dans le fallback par initiales', () => {
    expect(getApporteurAbbreviation('  alpha   beta   gamma  ')).toBe('ABG')
  })

  it('met les initiales en majuscules', () => {
    expect(getApporteurAbbreviation('alpha beta')).toBe('AB')
    expect(getApporteurAbbreviation('med tech advisors')).toBe('MTA')
  })

  it('retourne les 3 premiers caractères en majuscules pour un seul mot', () => {
    expect(getApporteurAbbreviation('cabinet')).toBe('CAB')
    expect(getApporteurAbbreviation('xy')).toBe('XY')
    expect(getApporteurAbbreviation('a')).toBe('A')
  })

  it('utilise le fallback 3 caractères pour un seul mot même avec espaces', () => {
    expect(getApporteurAbbreviation('  medical  ')).toBe('MED')
  })

  it('privilégie le mapping connu avant le calcul des initiales', () => {
    expect(getApporteurAbbreviation('MedTech Advisors')).toBe('MTA')
    expect(getApporteurAbbreviation('Softway Medical')).not.toBe('SM')
  })

  it('gère les caractères accentués dans le fallback', () => {
    expect(getApporteurAbbreviation('Équipe Santé')).toBe('ÉS')
    expect(getApporteurAbbreviation('école')).toBe('ÉCO')
  })

  it('produit des résultats précis sur plusieurs cas métier réels et limites', () => {
    const cases: Array<[string, string]> = [
      ['Softway Médical', 'SWM'],
      ['Softway Medical', 'SWM'],
      ['MedTech Advisors', 'MTA'],
      ['Groupe Hippocrate', 'GH'],
      ['Nova Care', 'NC'],
      ['one two three four', 'OTT'],
      ['solo', 'SOL'],
      ['io', 'IO'],
      ['  a  b  ', 'AB'],
    ]

    cases.forEach(([input, output]) => {
      expect(getApporteurAbbreviation(input)).toBe(output)
    })
  })
})
