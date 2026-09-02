import { TutorielModule } from '@/types/tutoriel'

export const facturationModule: TutorielModule = {
  id: 'facturation',
  title: 'Facturation & Devis',
  description: 'Créez vos devis, factures et avoirs avec export comptable automatisé',
  icon: 'Receipt',
  category: 'finance',
  estimatedTime: '12 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'creation-factures',
      title: 'Création de factures',
      description: 'Générer des factures professionnelles',
      steps: [
        {
          id: 'nouvelle-facture',
          title: 'Créer une nouvelle facture',
          content: 'Créez une facture depuis la fiche établissement ou depuis le module Trésorerie.',
          detailedContent: `Pour créer une facture:

1. Sélectionnez l\'établissement client
2. Ajoutez les lignes de facturation
3. Appliquez les remises éventuelles
4. Vérifiez les informations de TVA
5. Générez le PDF`,
          tip: 'Les informations client sont pré-remplies depuis la fiche établissement.'
        },
        {
          id: 'lignes-facturation',
          title: 'Ajouter des lignes',
          content: 'Ajoutez des lignes avec désignation, quantité, prix unitaire et taux de TVA.',
          detailedContent: `Chaque ligne de facture contient:

- Désignation du produit/service
- Description détaillée (optionnelle)
- Quantité et unité
- Prix unitaire HT
- Taux de TVA applicable
- Montant HT calculé automatiquement`,
          example: 'Licence SaaS annuelle | Qté: 1 | PU HT: 12 000€ | TVA 20% | Total TTC: 14 400€'
        }
      ]
    },
    {
      id: 'gestion-devis',
      title: 'Gestion des devis',
      description: 'Créer et transformer des devis en factures',
      steps: [
        {
          id: 'creation-devis',
          title: 'Créer un devis',
          content: 'Le devis suit le même format que la facture mais avec un statut spécifique.',
          detailedContent: `Le cycle de vie d\'un devis:

- **Brouillon**: En cours de rédaction
- **Envoyé**: Transmis au client
- **Accepté**: Client a validé → peut être converti en facture
- **Refusé**: Client a décliné
- **Expiré**: Date de validité dépassée`,
          tip: 'Configurez une durée de validité par défaut dans les paramètres.'
        },
        {
          id: 'conversion-facture',
          title: 'Convertir en facture',
          content: 'Un devis accepté peut être converti en facture en un clic.',
          detailedContent: `La conversion en facture:

- Reprend toutes les lignes du devis
- Génère un nouveau numéro de facture
- Lie la facture au devis source
- Conserve l\'historique complet`
        }
      ]
    },
    {
      id: 'avoirs-exports',
      title: 'Avoirs et exports',
      description: 'Gérer les avoirs et l\'export comptable',
      steps: [
        {
          id: 'creation-avoir',
          title: 'Créer un avoir',
          content: 'Générez un avoir total ou partiel sur une facture existante.',
          detailedContent: `Pour créer un avoir:

1. Ouvrez la facture concernée
2. Cliquez sur "Créer un avoir"
3. Sélectionnez les lignes à rembourser
4. Indiquez le motif (erreur, annulation, geste commercial)
5. Validez et générez le PDF`,
          warning: 'Un avoir validé ne peut plus être modifié.'
        },
        {
          id: 'export-fec',
          title: 'Export FEC',
          content: 'Exportez vos écritures au format FEC pour votre comptabilité.',
          detailedContent: `L\'export FEC génère un fichier normalisé contenant:

- Toutes les écritures de vente
- Format conforme à l\'administration fiscale
- Période personnalisable
- Téléchargement direct ou envoi automatique`,
          example: 'Export FEC T1 2024 → 156 écritures | Fichier: FEC_2024_T1.txt'
        }
      ]
    }
  ]
}
