import { TutorielModule } from '@/types/tutoriel'

/**

 * Le seul module écrit pour la distribution, et non hérité de l'éditeur
 * d'origine : il décrit ce qu'un adoptant rencontre AVANT tous les autres
 * écrans — l'assistant de premier lancement, puis l'écran de configuration
 * où l'on revient ensuite.
 *

 * Chaque étape ci-dessous correspond à une étape réelle de
 * `src/components/onboarding/champsConfiguration.ts`. Décrire un écran qui
 * n'existe pas serait pire que ne rien décrire.
 */
export const premierDemarrageModule: TutorielModule = {
  id: 'premier-demarrage',
  title: 'Premier démarrage',
  description: "Configurez votre instance : marque, organisation, mentions légales, courriels",
  icon: 'Rocket',
  category: 'debutant',
  estimatedTime: '12 min',
  level: 'debutant',
  sections: [
    {
      id: 'assistant',
      title: "L'assistant de premier lancement",
      description: "Ce que l'application vous demande la toute première fois",
      steps: [
        {
          id: 'declenchement',
          title: "Quand l'assistant s'affiche",
          content:
            "Tant qu'aucune configuration n'a été enregistrée, l'application affiche l'assistant avant tout autre écran, dès la première connexion d'un administrateur.",
          detailedContent:
            "L'assistant compte six étapes : votre marque, votre organisation, vos mentions légales, vos courriels sortants, le pied de page de vos documents et votre adresse publique.\nChacune écrit une clé de configuration que le reste de l'application lit déjà.",
          tip: "Rien n'est figé : tout se modifie ensuite depuis Paramètres → Configuration.",
          warning:
            "Un utilisateur non administrateur voit un message d'attente plutôt que l'assistant. C'est voulu : la sécurité au niveau ligne lui refuserait l'écriture à la dernière étape, après qu'il aurait tout saisi.",
        },
        {
          id: 'marque',
          title: 'Votre marque',
          content:
            "Le nom et le logo affichés dans l'application. Ils remplacent ceux livrés par défaut, sans reconstruire l'application.",
          detailedContent:
            "Le nom apparaît sur l'écran de connexion, dans la barre latérale et dans l'onglet du navigateur.\nLe logo accepte un chemin interne ou une adresse complète ; laissé vide, le logo livré est conservé.",
          example: "Nom affiché « Ma Société » : l'écran de connexion cesse d'afficher le nom livré par défaut.",
        },
        {
          id: 'organisation',
          title: 'Votre organisation et vos mentions légales',
          content:
            "L'identité qui apparaît dans l'application, sur vos documents et dans vos courriels, puis les identifiants légaux qui figurent sur vos factures.",
          detailedContent:
            "Les mentions légales portent le SIRET ou l'identifiant d'entreprise, le numéro de TVA intracommunautaire, l'IBAN et le BIC.\nCes champs alimentent directement les factures et les devis.",
          warning:
            "Une facture émise sans ces mentions n'est pas conforme. Le champ est facultatif dans le formulaire, pas dans la loi.",
        },
        {
          id: 'courriels',
          title: 'Vos courriels sortants',
          content:
            "Les adresses depuis lesquelles l'application expédie ses messages automatiques.",
          detailedContent:
            "Renseignez des adresses qui existent réellement sur votre domaine.\nUn envoi depuis une adresse inconnue du domaine est rejeté par la plupart des messageries, souvent sans rebond visible.",
          tip: "Vérifiez que votre domaine publie bien les enregistrements SPF et DKIM correspondants.",
        },
        {
          id: 'adresse-publique',
          title: 'Votre adresse publique',
          content:
            "L'adresse à laquelle vos utilisateurs joignent l'instance. Elle sert à composer les liens des courriels et des documents.",
          detailedContent:
            "Sans elle, un lien envoyé par courriel pointe vers l'adresse de construction et non vers votre instance : le destinataire tombe sur une page introuvable.",
        },
      ],
    },
    {
      id: 'configuration',
      title: 'Revenir sur la configuration',
      description: "Modifier les réglages posés au premier démarrage",
      steps: [
        {
          id: 'ecran',
          title: "L'écran de configuration",
          content:
            "Paramètres → Configuration réunit les mêmes clés que l'assistant, ainsi que celles qu'il ne demande pas.",
          detailedContent:
            "L'écran est réservé aux administrateurs. Les autres comptes peuvent lire la configuration mais pas l'écrire.",
          relatedLinks: [{ label: 'Ouvrir la configuration', href: '/parametres/configuration' }],
        },
        {
          id: 'applications-externes',
          title: 'Vos applications externes',
          content:
            "Déclarez les outils que votre organisation utilise à côté d'OpenPulse pour qu'ils apparaissent dans le menu.",
          detailedContent:
            "Chaque entrée porte un libellé, une adresse et les équipes autorisées à la voir.\nUne entrée sans adresse valide n'est pas affichée : le menu ne montre jamais un lien mort.",
        },
      ],
    },
  ],
}
