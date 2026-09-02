import { describe, it, expect } from 'vitest';
import type {
  GroupeRelation,
  EtablissementRelation,
  ProfileRelation,
  ProjetRelation,
  SprintRelation,
  EpicRelation,
  PartenaireRelation,
  EtablissementWithGroupe,
  EtablissementWithPartenaire,
  EtablissementWithRelations,
  ContactWithEtablissement,
  ContactWithGroupe,
  TacheWithRelations,
  StoryWithProjet,
  StoryWithEpic,
  StoryWithRelations,
  SprintWithProjet,
  RdTaskWithStory,
  TicketWithEtablissement,
  TicketWithRelations,
  SalaireMensuelWithProfile,
  AbsenceWithProfile,
  DocumentRhWithProfile,
  ThreadWithEtablissement,
  ThreadWithRelations,
  FactureWithEtablissement,
  DevisWithEtablissement,
  BookingWithRelations,
  CandidatWithEvaluations,
  WithOptionalRelations,
  BookingPageUpdate,
  BookingStatusUpdate,
  ContactInsertFromPending,
  BulletinSalaireUpdate,
} from './database-relations';

describe('database-relations', () => {
  it('expose des types de relations minimales compatibles avec les données métier attendues', () => {
    const groupe: GroupeRelation = {
      id: 'grp-1',
      nom: 'Groupe Atlas',
    };

    const etablissement: EtablissementRelation = {
      id: 'eta-1',
      nom: 'Clinique Atlas',
      ville: 'Lyon',
    };

    const profile: ProfileRelation = {
      id: 'usr-1',
      prenom: 'Marie',
      nom: 'Durand',
      email: 'marie@example.test',
      avatar_url: 'avatar.png',
    };

    const projet: ProjetRelation = {
      id: 'prj-1',
      nom: 'Refonte CRM',
    };

    const sprint: SprintRelation = {
      id: 'spr-1',
      nom: 'Sprint 12',
      numero: 12,
    };

    const epic: EpicRelation = {
      id: 'epc-1',
      titre: 'Onboarding',
    };

    const partenaire: PartenaireRelation = {
      id: 'par-1',
      nom: 'Cabinet Conseil',
      type_partenaire: 'apporteur',
    };

    expect(groupe.nom).toBe('Groupe Atlas');
    expect(etablissement.ville).toBe('Lyon');
    expect(profile.email).toBe('marie@example.test');
    expect(projet.nom).toContain('CRM');
    expect(sprint.numero).toBe(12);
    expect(epic.titre).toBe('Onboarding');
    expect(partenaire.type_partenaire).toBe('apporteur');
  });

  it('permet de composer des types étendus CRM avec les bonnes relations optionnelles', () => {
    const etabWithGroupe: EtablissementWithGroupe = {
      id: 'eta-1',
      nom: 'Clinique Atlas',
      groupe: {
        id: 'grp-1',
        nom: 'Groupe Atlas',
      },
    } as EtablissementWithGroupe;

    const etabWithPartenaire: EtablissementWithPartenaire = {
      id: 'eta-2',
      nom: 'Centre Nova',
      partenaire_apporteur: {
        id: 'par-1',
        nom: 'Cabinet Conseil',
        type_partenaire: 'apporteur',
      },
    } as EtablissementWithPartenaire;

    const etabWithRelations: EtablissementWithRelations = {
      id: 'eta-3',
      nom: 'Hôpital Horizon',
      groupe: {
        id: 'grp-2',
        nom: 'Groupe Horizon',
      },
      partenaire_apporteur: {
        id: 'par-2',
        nom: 'Agence Growth',
        type_partenaire: 'revendeur',
      },
      commercial: {
        id: 'usr-10',
        prenom: 'Lina',
        nom: 'Morel',
        email: 'lina@example.test',
      },
      csm: {
        id: 'usr-11',
        prenom: 'Noah',
        nom: 'Petit',
      },
    } as EtablissementWithRelations;

    const contactWithEtablissement: ContactWithEtablissement = {
      id: 'ct-1',
      email: 'contact@example.test',
      etablissement: {
        id: 'eta-1',
        nom: 'Clinique Atlas',
        ville: 'Lyon',
      },
    } as ContactWithEtablissement;

    const contactWithGroupe: ContactWithGroupe = {
      id: 'ct-2',
      email: 'dir@example.test',
      groupe: {
        id: 'grp-1',
        nom: 'Groupe Atlas',
      },
    } as ContactWithGroupe;

    const tacheWithRelations: TacheWithRelations = {
      id: 'tsk-1',
      titre: 'Relancer le client',
      etablissement: {
        id: 'eta-1',
        nom: 'Clinique Atlas',
      },
      assigned_user: {
        id: 'usr-1',
        prenom: 'Marie',
        nom: 'Durand',
      },
      created_by_user: {
        id: 'usr-2',
        prenom: 'Paul',
        nom: 'Martin',
      },
    } as TacheWithRelations;

    expect(etabWithGroupe.groupe?.nom).toBe('Groupe Atlas');
    expect(etabWithPartenaire.partenaire_apporteur?.type_partenaire).toBe('apporteur');
    expect(etabWithRelations.commercial?.prenom).toBe('Lina');
    expect(etabWithRelations.csm?.nom).toBe('Petit');
    expect(contactWithEtablissement.etablissement?.ville).toBe('Lyon');
    expect(contactWithGroupe.groupe?.id).toBe('grp-1');
    expect(tacheWithRelations.assigned_user?.prenom).toBe('Marie');
    expect(tacheWithRelations.created_by_user?.nom).toBe('Martin');
  });

  it('permet de composer des types étendus R&D avec projet, epic, sprint et assignee', () => {
    const storyWithProjet: StoryWithProjet = {
      id: 'us-1',
      titre: 'Créer un pipeline',
      projet: {
        id: 'prj-1',
        nom: 'Refonte CRM',
      },
    } as StoryWithProjet;

    const storyWithEpic: StoryWithEpic = {
      id: 'us-2',
      titre: 'Améliorer le back-office',
      epic: {
        id: 'epc-1',
        titre: 'Onboarding',
      },
    } as StoryWithEpic;

    const storyWithRelations: StoryWithRelations = {
      id: 'us-3',
      titre: 'Associer un contact à un établissement',
      projet: {
        id: 'prj-2',
        nom: 'Data Quality',
      },
      epic: {
        id: 'epc-2',
        titre: 'Relations CRM',
      },
      sprint: {
        id: 'spr-9',
        nom: 'Sprint 9',
        numero: 9,
      },
      assignee: {
        id: 'usr-3',
        prenom: 'Emma',
        nom: 'Lopez',
        email: 'emma@example.test',
      },
    } as StoryWithRelations;

    const sprintWithProjet: SprintWithProjet = {
      id: 'spr-1',
      nom: 'Sprint 12',
      projet: {
        id: 'prj-1',
        nom: 'Refonte CRM',
      },
    } as SprintWithProjet;

    const rdTaskWithStory: RdTaskWithStory = {
      id: 'rdt-1',
      titre: 'Développer la vue détail',
      user_story: {
        id: 'us-3',
        titre: 'Associer un contact à un établissement',
        code: 'US-3',
      },
      assignee: {
        id: 'usr-4',
        prenom: 'Hugo',
        nom: 'Bernard',
      },
    } as RdTaskWithStory;

    expect(storyWithProjet.projet?.nom).toBe('Refonte CRM');
    expect(storyWithEpic.epic?.titre).toBe('Onboarding');
    expect(storyWithRelations.sprint?.numero).toBe(9);
    expect(storyWithRelations.assignee?.email).toBe('emma@example.test');
    expect(sprintWithProjet.projet?.id).toBe('prj-1');
    expect(rdTaskWithStory.user_story?.code).toBe('US-3');
    expect(rdTaskWithStory.assignee?.prenom).toBe('Hugo');
  });

  it('permet de composer des types étendus support, RH, email, facturation, booking et recrutement', () => {
    const ticketWithEtablissement: TicketWithEtablissement = {
      id: 'tic-1',
      sujet: 'Erreur de synchronisation',
      etablissement: {
        id: 'eta-1',
        nom: 'Clinique Atlas',
      },
    } as TicketWithEtablissement;

    const ticketWithRelations: TicketWithRelations = {
      id: 'tic-2',
      sujet: 'Compte bloqué',
      etablissement: {
        id: 'eta-2',
        nom: 'Centre Nova',
      },
      assigned_to_user: {
        id: 'usr-5',
        prenom: 'Sarah',
        nom: 'Meyer',
      },
      created_by_user: {
        id: 'usr-6',
        prenom: 'Tom',
        nom: 'Roux',
      },
    } as TicketWithRelations;

    const salaire: SalaireMensuelWithProfile = {
      id: 'sal-1',
      profile: {
        id: 'usr-7',
        prenom: 'Alice',
        nom: 'Girard',
      },
    } as SalaireMensuelWithProfile;

    const absence: AbsenceWithProfile = {
      id: 'abs-1',
      profile: {
        id: 'usr-8',
        prenom: 'Louis',
        nom: 'Perrot',
      },
    } as AbsenceWithProfile;

    const documentRh: DocumentRhWithProfile = {
      id: 'doc-1',
      profile: {
        id: 'usr-9',
        prenom: 'Zoé',
        nom: 'Faure',
      },
    } as DocumentRhWithProfile;

    const threadWithEtab: ThreadWithEtablissement = {
      id: 'thr-1',
      subject: 'Demande de devis',
      etablissement: {
        id: 'eta-3',
        nom: 'Hôpital Horizon',
        ville: 'Paris',
      },
    } as ThreadWithEtablissement;

    const threadWithRelations: ThreadWithRelations = {
      id: 'thr-2',
      subject: 'Suivi partenariat',
      etablissement: {
        id: 'eta-4',
        nom: 'Maison Santé',
      },
      groupe: {
        id: 'grp-3',
        nom: 'Groupe Santé+',
      },
      partenaire: {
        id: 'par-3',
        nom: 'Reseau Partenaire',
        type_partenaire: 'apporteur',
      },
    } as ThreadWithRelations;

    const facture: FactureWithEtablissement = {
      id: 'fac-1',
      numero: 'F-2024-001',
      etablissement: {
        id: 'eta-5',
        nom: 'Cabinet Delta',
      },
    } as FactureWithEtablissement;

    const devis: DevisWithEtablissement = {
      id: 'dev-1',
      numero: 'D-2024-001',
      etablissement: {
        id: 'eta-6',
        nom: 'Clinique Sigma',
      },
      commercial: {
        id: 'usr-12',
        prenom: 'Nina',
        nom: 'Colin',
      },
    } as DevisWithEtablissement;

    const booking: BookingWithRelations = {
      id: 'bok-1',
      etablissement: {
        id: 'eta-7',
        nom: 'Centre Echo',
      },
      booking_type: {
        id: 'bt-1',
        name: 'Démo produit',
        duration_minutes: 45,
      },
      host: {
        id: 'usr-13',
        prenom: 'Leo',
        nom: 'Barbier',
      },
    } as BookingWithRelations;

    const candidat: CandidatWithEvaluations = {
      id: 'cand-1',
      first_name: 'Iris',
      evaluations: [
        {
          id: 'eval-1',
          note_globale: 4,
          evaluator: {
            id: 'usr-14',
            prenom: 'Jade',
            nom: 'Michel',
          },
        },
      ],
    } as CandidatWithEvaluations;

    expect(ticketWithEtablissement.etablissement?.nom).toBe('Clinique Atlas');
    expect(ticketWithRelations.assigned_to_user?.prenom).toBe('Sarah');
    expect(ticketWithRelations.created_by_user?.nom).toBe('Roux');
    expect(salaire.profile?.id).toBe('usr-7');
    expect(absence.profile?.prenom).toBe('Louis');
    expect(documentRh.profile?.nom).toBe('Faure');
    expect(threadWithEtab.etablissement?.ville).toBe('Paris');
    expect(threadWithRelations.groupe?.nom).toBe('Groupe Santé+');
    expect(threadWithRelations.partenaire?.type_partenaire).toBe('apporteur');
    expect(facture.etablissement?.nom).toBe('Cabinet Delta');
    expect(devis.commercial?.prenom).toBe('Nina');
    expect(booking.booking_type?.duration_minutes).toBe(45);
    expect(booking.host?.nom).toBe('Barbier');
    expect(candidat.evaluations?.[0]?.note_globale).toBe(4);
    expect(candidat.evaluations?.[0]?.evaluator?.prenom).toBe('Jade');
  });

  it('permet de réutiliser le helper WithOptionalRelations pour typer des relations nullables et optionnelles', () => {
    type CustomEtab = WithOptionalRelations<
      { id: string; nom: string; actif: boolean },
      {
        groupe: GroupeRelation;
        commercial: ProfileRelation;
      }
    >;

    const withRelations: CustomEtab = {
      id: 'eta-1',
      nom: 'Clinique Atlas',
      actif: true,
      groupe: {
        id: 'grp-1',
        nom: 'Groupe Atlas',
      },
      commercial: {
        id: 'usr-1',
        prenom: 'Marie',
        nom: 'Durand',
      },
    };

    const withoutRelations: CustomEtab = {
      id: 'eta-2',
      nom: 'Centre Nova',
      actif: false,
      groupe: null,
    };

    expect(withRelations.groupe?.nom).toBe('Groupe Atlas');
    expect(withRelations.commercial?.prenom).toBe('Marie');
    expect(withoutRelations.actif).toBe(false);
    expect(withoutRelations.groupe).toBeNull();
    expect('commercial' in withoutRelations).toBe(false);
  });

  it('décrit correctement les types de mutation pour les mises à jour et insertions métier', () => {
    const bookingPageUpdate: BookingPageUpdate = {
      title: 'Nouvelle page de réservation',
      is_active: true,
    } as BookingPageUpdate;

    const bookingStatusUpdate: BookingStatusUpdate = {
      status: 'confirmed',
      confirmed_at: '2024-03-20T10:30:00Z',
    };

    const contactInsert: ContactInsertFromPending = {
      email: 'lead@example.test',
      prenom: 'Camille',
      nom: 'Renaud',
      created_source: 'email_ai',
      created_metadata: {
        email_thread_id: 'thr-9',
        confidence: 0.92,
        approved_at: '2024-03-21T09:00:00Z',
        reviewed_by: 'usr-1',
      },
    } as ContactInsertFromPending;

    const bulletinUpdate: BulletinSalaireUpdate = {
      salaire_brut: 3200,
      salaire_net: 2480,
      cout_employeur: 4100,
      conges_payes: 2.5,
    };

    expect(bookingPageUpdate.title).toBe('Nouvelle page de réservation');
    expect(bookingPageUpdate.is_active).toBe(true);
    expect(bookingStatusUpdate.status).toBe('confirmed');
    expect(bookingStatusUpdate.confirmed_at).toContain('T10:30:00Z');
    expect(contactInsert.created_source).toBe('email_ai');
    expect(contactInsert.created_metadata?.confidence).toBe(0.92);
    expect(contactInsert.created_metadata?.reviewed_by).toBe('usr-1');
    expect(bulletinUpdate.salaire_brut).toBe(3200);
    expect(bulletinUpdate.salaire_net).toBeLessThan(bulletinUpdate.cout_employeur ?? 0);
    expect(bulletinUpdate.conges_payes).toBe(2.5);
  });
});