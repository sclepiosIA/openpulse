import { describe, it, expect } from 'vitest';
import {
  CatalogueRecurrence,
  RECURRENCE_LABELS,
  Devis,
  DevisStatut,
  DevisLigne,
  Facture,
  FactureStatut,
  FactureLigne,
  PaiementFacture,
  DEVIS_STATUT_LABELS,
  DEVIS_STATUT_COLORS,
  FACTURE_STATUT_LABELS,
  FACTURE_STATUT_COLORS,
  PRODUIT_TYPE_LABELS,
  MODE_PAIEMENT_LABELS,
} from './facturation';

describe('facturation module - types and labels', () => {
  it('RECURRENCE_LABELS should cover all CatalogueRecurrence values with correct labels', () => {
    const keys = Object.keys(RECURRENCE_LABELS);
    expect(keys.sort()).toEqual(['none', 'monthly', 'quarterly', 'yearly'].sort());

    expect(RECURRENCE_LABELS.none).toBe('Ponctuel');
    expect(RECURRENCE_LABELS.monthly).toBe('Mensuel');
    expect(RECURRENCE_LABELS.quarterly).toBe('Trimestriel');
    expect(RECURRENCE_LABELS.yearly).toBe('Annuel');

    const values = Object.values(RECURRENCE_LABELS);
    values.forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('DEVIS_STATUT_LABELS should cover all DevisStatut values with specific labels', () => {
    const allStatus: DevisStatut[] = [
      'brouillon',
      'envoye',
      'en_negociation',
      'accepte',
      'refuse',
      'expire',
      'converti',
    ];

    const keys = Object.keys(DEVIS_STATUT_LABELS);
    expect(keys.sort()).toEqual(allStatus.sort());

    expect(DEVIS_STATUT_LABELS.brouillon).toBe('Brouillon');
    expect(DEVIS_STATUT_LABELS.envoye).toBe('Envoyé');
    expect(DEVIS_STATUT_LABELS.en_negociation).toBe('En négociation');
    expect(DEVIS_STATUT_LABELS.accepte).toBe('Accepté');
    expect(DEVIS_STATUT_LABELS.refuse).toBe('Refusé');
    expect(DEVIS_STATUT_LABELS.expire).toBe('Expiré');
    expect(DEVIS_STATUT_LABELS.converti).toBe('Converti en facture');

    Object.values(DEVIS_STATUT_LABELS).forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('DEVIS_STATUT_COLORS should cover all DevisStatut values with non-empty Tailwind classes', () => {
    const allStatus: DevisStatut[] = [
      'brouillon',
      'envoye',
      'en_negociation',
      'accepte',
      'refuse',
      'expire',
      'converti',
    ];

    const keys = Object.keys(DEVIS_STATUT_COLORS);
    expect(keys.sort()).toEqual(allStatus.sort());

    expect(DEVIS_STATUT_COLORS.brouillon).toBe('bg-gray-100 text-gray-700');
    expect(DEVIS_STATUT_COLORS.envoye).toBe('bg-blue-100 text-blue-700');
    expect(DEVIS_STATUT_COLORS.en_negociation).toBe('bg-amber-100 text-amber-700');
    expect(DEVIS_STATUT_COLORS.accepte).toBe('bg-green-100 text-green-700');
    expect(DEVIS_STATUT_COLORS.refuse).toBe('bg-red-100 text-red-700');
    expect(DEVIS_STATUT_COLORS.expire).toBe('bg-gray-200 text-gray-600');
    expect(DEVIS_STATUT_COLORS.converti).toBe('bg-emerald-100 text-emerald-700');

    Object.values(DEVIS_STATUT_COLORS).forEach(colorClass => {
      expect(typeof colorClass).toBe('string');
      expect(colorClass.length).toBeGreaterThan(0);
      expect(colorClass).toMatch(/bg-/);
      expect(colorClass).toMatch(/text-/);
    });
  });

  it('FACTURE_STATUT_LABELS should cover all FactureStatut values with specific labels', () => {
    const allStatus: FactureStatut[] = [
      'brouillon',
      'emise',
      'envoyee',
      'en_attente',
      'partiellement_payee',
      'payee',
      'annulee',
      'contentieux',
    ];

    const keys = Object.keys(FACTURE_STATUT_LABELS);
    expect(keys.sort()).toEqual(allStatus.sort());

    expect(FACTURE_STATUT_LABELS.brouillon).toBe('Brouillon');
    expect(FACTURE_STATUT_LABELS.emise).toBe('Émise');
    expect(FACTURE_STATUT_LABELS.envoyee).toBe('Envoyée');
    expect(FACTURE_STATUT_LABELS.en_attente).toBe('En attente');
    expect(FACTURE_STATUT_LABELS.partiellement_payee).toBe('Partiellement payée');
    expect(FACTURE_STATUT_LABELS.payee).toBe('Payée');
    expect(FACTURE_STATUT_LABELS.annulee).toBe('Annulée');
    expect(FACTURE_STATUT_LABELS.contentieux).toBe('Contentieux');

    Object.values(FACTURE_STATUT_LABELS).forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('FACTURE_STATUT_COLORS should cover all FactureStatut values with non-empty Tailwind classes', () => {
    const allStatus: FactureStatut[] = [
      'brouillon',
      'emise',
      'envoyee',
      'en_attente',
      'partiellement_payee',
      'payee',
      'annulee',
      'contentieux',
    ];

    const keys = Object.keys(FACTURE_STATUT_COLORS);
    expect(keys.sort()).toEqual(allStatus.sort());

    expect(FACTURE_STATUT_COLORS.brouillon).toBe('bg-gray-100 text-gray-700');
    expect(FACTURE_STATUT_COLORS.emise).toBe('bg-blue-100 text-blue-700');
    expect(FACTURE_STATUT_COLORS.envoyee).toBe('bg-sky-100 text-sky-700');
    expect(FACTURE_STATUT_COLORS.en_attente).toBe('bg-amber-100 text-amber-700');
    expect(FACTURE_STATUT_COLORS.partiellement_payee).toBe('bg-orange-100 text-orange-700');
    expect(FACTURE_STATUT_COLORS.payee).toBe('bg-green-100 text-green-700');
    expect(FACTURE_STATUT_COLORS.annulee).toBe('bg-red-100 text-red-700');
    expect(FACTURE_STATUT_COLORS.contentieux).toBe('bg-red-200 text-red-800');

    Object.values(FACTURE_STATUT_COLORS).forEach(colorClass => {
      expect(typeof colorClass).toBe('string');
      expect(colorClass.length).toBeGreaterThan(0);
      expect(colorClass).toMatch(/bg-/);
      expect(colorClass).toMatch(/text-/);
    });
  });

  it('PRODUIT_TYPE_LABELS should map known types to human-readable labels', () => {
    const expectedKeys = ['service', 'produit', 'licence', 'formation', 'maintenance'];
    const keys = Object.keys(PRODUIT_TYPE_LABELS);
    expect(keys.sort()).toEqual(expectedKeys.sort());

    expect(PRODUIT_TYPE_LABELS.service).toBe('Service');
    expect(PRODUIT_TYPE_LABELS.produit).toBe('Produit');
    expect(PRODUIT_TYPE_LABELS.licence).toBe('Licence');
    expect(PRODUIT_TYPE_LABELS.formation).toBe('Formation');
    expect(PRODUIT_TYPE_LABELS.maintenance).toBe('Maintenance');

    Object.entries(PRODUIT_TYPE_LABELS).forEach(([key, label]) => {
      expect(typeof key).toBe('string');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('MODE_PAIEMENT_LABELS should map known payment modes to human-readable labels', () => {
    const expectedKeys = [
      'virement',
      'cheque',
      'carte',
      'prelevement',
      'especes',
      'autre',
    ];
    const keys = Object.keys(MODE_PAIEMENT_LABELS);
    expect(keys.sort()).toEqual(expectedKeys.sort());

    expect(MODE_PAIEMENT_LABELS.virement).toBe('Virement bancaire');
    expect(MODE_PAIEMENT_LABELS.cheque).toBe('Chèque');
    expect(MODE_PAIEMENT_LABELS.carte).toBe('Carte bancaire');
    expect(MODE_PAIEMENT_LABELS.prelevement).toBe('Prélèvement');
    expect(MODE_PAIEMENT_LABELS.especes).toBe('Espèces');
    expect(MODE_PAIEMENT_LABELS.autre).toBe('Autre');

    Object.entries(MODE_PAIEMENT_LABELS).forEach(([key, label]) => {
      expect(typeof key).toBe('string');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('Devis type structure should be compatible with expected numeric and string fields', () => {
    const devis: Devis = {
      id: 'd1',
      numero: 'D-2024-001',
      etablissement_id: null,
      groupe_id: null,
      partenaire_id: null,
      contact_id: null,
      client_nom: 'Client Test',
      client_adresse: null,
      client_email: null,
      client_telephone: null,
      client_siret: null,
      date_emission: '2024-01-01',
      date_validite: '2024-01-31',
      date_signature: null,
      statut: 'brouillon',
      montant_ht: 1000,
      montant_tva: 200,
      montant_ttc: 1200,
      remise_globale_pourcent: null,
      remise_globale_montant: null,
      conditions_paiement: null,
      notes_internes: null,
      notes_client: null,
      signature_url: null,
      signe_par: null,
      signe_le: null,
      created_by: null,
      commercial_id: null,
      facture_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      etablissement: null,
      contact: null,
      commercial: null,
      lignes: [],
    };

    expect(devis.numero).toContain('D-');
    expect(devis.montant_ttc).toBe(devis.montant_ht + devis.montant_tva);
    expect(devis.statut).toBe('brouillon');
    expect(devis.lignes).toEqual([]);
  });

  it('DevisLigne type structure should support nullables and numeric fields', () => {
    const ligne: DevisLigne = {
      id: 'l1',
      devis_id: 'd1',
      produit_id: null,
      ordre: 1,
      designation: 'Prestation de test',
      description: null,
      quantite: 2,
      unite: 'jour',
      prix_unitaire_ht: 500,
      taux_tva: 20,
      remise_pourcent: null,
      montant_ht: 1000,
      montant_tva: 200,
      montant_ttc: 1200,
      created_at: '2024-01-01T00:00:00Z',
      produit: null,
    };

    expect(ligne.quantite).toBeGreaterThan(0);
    expect(ligne.montant_ht).toBe(ligne.quantite * ligne.prix_unitaire_ht);
    expect(ligne.montant_ttc).toBe(ligne.montant_ht + ligne.montant_tva);
  });

  it('Facture type structure should be compatible with monetary fields and relations', () => {
    const facture: Facture = {
      id: 'f1',
      numero: 'F-2024-001',
      etablissement_id: null,
      groupe_id: null,
      partenaire_id: null,
      contact_id: null,
      client_nom: 'Client Test',
      client_adresse: null,
      client_email: null,
      client_telephone: null,
      client_siret: null,
      date_emission: '2024-02-01',
      date_echeance: '2024-02-28',
      statut: 'en_attente',
      montant_ht: 1000,
      montant_tva: 200,
      montant_ttc: 1200,
      montant_paye: 0,
      remise_globale_pourcent: null,
      remise_globale_montant: null,
      conditions_paiement: null,
      mode_paiement: null,
      notes_internes: null,
      notes_client: null,
      devis_id: null,
      numero_bon_commande: null,
      created_by: null,
      commercial_id: null,
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
      etablissement: null,
      contact: null,
      commercial: null,
      devis: null,
      lignes: [],
      paiements: [],
    };

    expect(facture.numero).toContain('F-');
    expect(facture.montant_ttc).toBe(facture.montant_ht + facture.montant_tva);
    expect(facture.montant_paye).toBe(0);
    expect(Array.isArray(facture.lignes)).toBe(true);
    expect(Array.isArray(facture.paiements)).toBe(true);
  });

  it('FactureLigne type structure should be coherent with DevisLigne shape', () => {
    const ligne: FactureLigne = {
      id: 'fl1',
      facture_id: 'f1',
      produit_id: null,
      devis_ligne_id: null,
      ordre: 1,
      designation: 'Prestation facturée',
      description: null,
      quantite: 3,
      unite: 'jour',
      prix_unitaire_ht: 300,
      taux_tva: 20,
      remise_pourcent: null,
      montant_ht: 900,
      montant_tva: 180,
      montant_ttc: 1080,
      created_at: '2024-02-01T00:00:00Z',
      produit: null,
    };

    expect(ligne.montant_ht).toBe(ligne.quantite * ligne.prix_unitaire_ht);
    expect(ligne.montant_ttc).toBe(ligne.montant_ht + ligne.montant_tva);
    expect(ligne.facture_id).toBe('f1');
  });

  it('PaiementFacture type structure should enforce positive amounts and known modes', () => {
    const paiement: PaiementFacture = {
      id: 'p1',
      facture_id: 'f1',
      montant: 500,
      date_paiement: '2024-02-15',
      mode_paiement: 'virement',
      reference_paiement: null,
      notes: null,
      created_by: null,
      created_at: '2024-02-15T00:00:00Z',
    };

    expect(paiement.montant).toBeGreaterThan(0);
    expect(['virement', 'cheque', 'carte', 'prelevement', 'especes', 'autre']).toContain(
      paiement.mode_paiement
    );
  });

  it('label and color maps should stay in sync for DevisStatut and FactureStatut', () => {
    const devisLabelKeys = Object.keys(DEVIS_STATUT_LABELS).sort();
    const devisColorKeys = Object.keys(DEVIS_STATUT_COLORS).sort();
    expect(devisLabelKeys).toEqual(devisColorKeys);

    const factureLabelKeys = Object.keys(FACTURE_STATUT_LABELS).sort();
    const factureColorKeys = Object.keys(FACTURE_STATUT_COLORS).sort();
    expect(factureLabelKeys).toEqual(factureColorKeys);
  });

  it('CatalogueRecurrence type should be compatible with RECURRENCE_LABELS keys', () => {
    const recurrences: CatalogueRecurrence[] = ['none', 'monthly', 'quarterly', 'yearly'];
    recurrences.forEach(r => {
      expect(RECURRENCE_LABELS[r]).toBeDefined();
    });
  });
});