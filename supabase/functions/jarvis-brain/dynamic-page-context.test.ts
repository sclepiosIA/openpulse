import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enrichWithPageContext, parsePageContext } from "./dynamic-page-context.ts";

type FixtureMap = Record<string, unknown>;

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

function makeSupabaseStub(fixtures: FixtureMap = {}) {
  const calls: QueryCall[] = [];

  class QueryBuilder {
    table: string;

    constructor(table: string) {
      this.table = table;
    }

    select(...args: unknown[]) {
      calls.push({ table: this.table, method: "select", args });
      return this;
    }

    eq(...args: unknown[]) {
      calls.push({ table: this.table, method: "eq", args });
      return this;
    }

    in(...args: unknown[]) {
      calls.push({ table: this.table, method: "in", args });
      return this;
    }

    order(...args: unknown[]) {
      calls.push({ table: this.table, method: "order", args });
      return this;
    }

    limit(...args: unknown[]) {
      calls.push({ table: this.table, method: "limit", args });
      return this;
    }

    maybeSingle() {
      calls.push({ table: this.table, method: "maybeSingle", args: [] });
      const value = fixtures[this.table];
      const data = Array.isArray(value) ? value[0] ?? null : value ?? null;
      return Promise.resolve({ data, error: null });
    }

    then(
      onfulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) {
      const value = fixtures[this.table];
      const data = Array.isArray(value) ? value : value == null ? [] : [value];
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from(table: string) {
      calls.push({ table, method: "from", args: [table] });
      return new QueryBuilder(table);
    },
  };

  return { supabase, calls };
}

Deno.test("parsePageContext returns null for null, empty, and incomplete contexts", () => {
  assertEquals(parsePageContext(null), null);
  assertEquals(parsePageContext(""), null);
  assertEquals(parsePageContext("[module: CRM]"), null);
  assertEquals(parsePageContext("[type: fiche]"), null);
  assertEquals(parsePageContext("plain text without metadata"), null);
});

Deno.test("parsePageContext parses supported keys, trims values, and ignores malformed lines", () => {
  const parsed = parsePageContext([
    "ignored line",
    "[module: CRM]",
    "[type: fiche_etablissement]",
    "[entity_id:   etab-123   ]",
    "[tab:   Synthèse   ]",
    "[filter:   actifs   ]",
    "[unknown: value]",
    " [module: SHOULD_NOT_OVERRIDE]",
  ].join("\n"));

  assertEquals(parsed, {
    module: "CRM",
    type: "fiche_etablissement",
    entityId: "etab-123",
    tab: "Synthèse",
    filter: "actifs",
  });
});

Deno.test("parsePageContext supports uppercase metadata keys and special characters in values", () => {
  const parsed = parsePageContext([
    "[MODULE: TRÉSORERIE]",
    "[TYPE: facture]",
    "[ENTITY_ID: fac-001]",
    "[TAB: Relances & paiements]",
  ].join("\n"));

  assertEquals(parsed, {
    module: "TRÉSORERIE",
    type: "facture",
    entityId: "fac-001",
    tab: "Relances & paiements",
  });
});

Deno.test("enrichWithPageContext returns an empty string when the page context is invalid", async () => {
  const { supabase, calls } = makeSupabaseStub();

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CRM]",
    "profile-1",
  );

  assertEquals(result, "");
  assertEquals(calls.length, 0);
});

Deno.test("enrichWithPageContext returns only the active page header when there is no entity id", async () => {
  const { supabase, calls } = makeSupabaseStub();

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CRM]\n[type: liste]\n[tab: Opportunités]",
    "profile-1",
  );

  assertEquals(result, "\n🖥️ PAGE ACTIVE: CRM > liste > Opportunités");
  assertEquals(calls.length, 0);
});

Deno.test("enrichWithPageContext enriches a CRM establishment with contacts and active tasks", async () => {
  const { supabase, calls } = makeSupabaseStub({
    etablissements: {
      id: "etab-1",
      nom: "Clinique Lumière",
      statut: "Client",
      phase: "Déploiement",
      ville: "Lyon",
      code_postal: "69002",
      nombre_utilisateurs: 42,
    },
    taches: [
      {
        id: "task-1",
        titre: "Préparer le comité de pilotage",
        statut: "En cours",
        priorite: "Haute",
      },
    ],
    contacts: [
      {
        id: "contact-1",
        prenom: "Alice",
        nom: "Martin",
        email: "alice@example.test",
        fonction: "Directrice",
        telephone: "0102030405",
      },
    ],
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CRM]\n[type: fiche]\n[entity_id: etab-1]\n[tab: Synthèse]",
    "profile-1",
  );

  assertEquals(result.includes("🖥️ PAGE ACTIVE: CRM > fiche > Synthèse"), true);
  assertEquals(result.includes("📍 ÉTABLISSEMENT ACTIF: [[etablissement:etab-1|Clinique Lumière]]"), true);
  assertEquals(result.includes("Statut: Client | Phase: Déploiement | Ville: Lyon 69002"), true);
  assertEquals(result.includes("Utilisateurs: 42"), true);
  assertEquals(result.includes("[[contact:contact-1|Alice Martin]] (Directrice) alice@example.test"), true);
  assertEquals(result.includes("[[task:task-1|Préparer le comité de pilotage]] [En cours]"), true);
  assertEquals(calls.some((call) => call.table === "etablissements" && call.method === "maybeSingle"), true);
  assertEquals(calls.some((call) => call.table === "taches" && call.method === "in"), true);
  assertEquals(calls.some((call) => call.table === "contacts" && call.method === "limit"), true);
});

Deno.test("enrichWithPageContext returns only the header when a CRM establishment is not found", async () => {
  const { supabase } = makeSupabaseStub({
    etablissements: null,
    taches: [],
    contacts: [],
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CRM]\n[type: fiche]\n[entity_id: missing-etab]",
    "profile-1",
  );

  assertEquals(result, "\n🖥️ PAGE ACTIVE: CRM > fiche");
});

Deno.test("enrichWithPageContext enriches an email thread", async () => {
  const { supabase } = makeSupabaseStub({
    email_threads: {
      id: "thread-1",
      subject: "Sujet original",
      ai_generated_title: "Synthèse renouvellement",
      category: "Client",
      etablissement_id: "etab-1",
      unread_count: 3,
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: EMAILS]\n[type: thread]\n[entity_id: thread-1]",
    "profile-1",
  );

  assertEquals(result.includes("📧 EMAIL ACTIF: [[email:thread-1|Synthèse renouvellement]]"), true);
  assertEquals(result.includes("Catégorie: Client | Non lus: 3"), true);
  assertEquals(result.includes("Lié à: [[etablissement:etab-1|établissement]]"), true);
});

Deno.test("enrichWithPageContext enriches a support ticket and truncates a long description", async () => {
  const longDescription = "A".repeat(250);
  const { supabase } = makeSupabaseStub({
    support_tickets: {
      id: "ticket-1",
      titre: "Erreur de connexion",
      description: longDescription,
      statut: "Ouvert",
      priorite: "Urgente",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: SUPPORT]\n[type: ticket]\n[entity_id: ticket-1]",
    "profile-1",
  );

  assertEquals(result.includes("🎫 TICKET ACTIF: [[ticket:ticket-1|Erreur de connexion]]"), true);
  assertEquals(result.includes("Statut: Ouvert | Priorité: Urgente"), true);
  assertEquals(result.includes(`Description: ${"A".repeat(200)}`), true);
  assertEquals(result.includes("A".repeat(201)), false);
});

Deno.test("enrichWithPageContext enriches R&D sprint and epic entities according to page type", async () => {
  const sprintStub = makeSupabaseStub({
    rd_sprints: {
      id: "sprint-1",
      name: "Sprint Phoenix",
      status: "active",
      start_date: "2024-01-01",
      end_date: "2024-01-15",
      goal: "Stabiliser les intégrations",
    },
  });

  const sprintResult = await enrichWithPageContext(
    sprintStub.supabase as any,
    "[module: R&D]\n[type: sprint]\n[entity_id: sprint-1]",
    "profile-1",
  );

  assertEquals(sprintResult.includes("🏃 SPRINT ACTIF: Sprint Phoenix [active] (2024-01-01 → 2024-01-15)"), true);
  assertEquals(sprintResult.includes("Objectif: Stabiliser les intégrations"), true);

  const epicStub = makeSupabaseStub({
    rd_epics: {
      id: "epic-1",
      title: "Refonte onboarding",
      status: "planned",
      priority: "P1",
      description: "Améliorer l'expérience de démarrage des nouveaux clients.",
    },
  });

  const epicResult = await enrichWithPageContext(
    epicStub.supabase as any,
    "[module: R&D]\n[type: epics]\n[entity_id: epic-1]",
    "profile-1",
  );

  assertEquals(epicResult.includes("📦 EPIC ACTIF: Refonte onboarding [planned] [P1]"), true);
  assertEquals(epicResult.includes("Améliorer l'expérience de démarrage"), true);
});

Deno.test("enrichWithPageContext enriches a recruitment candidate", async () => {
  const { supabase } = makeSupabaseStub({
    candidates: {
      id: "cand-1",
      prenom: "Nora",
      nom: "Bernard",
      email: "nora@example.test",
      poste_vise: "Customer Success Manager",
      statut: "Entretien",
      score_global: 87,
      source: "LinkedIn",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: RECRUTEMENT]\n[type: candidat]\n[entity_id: cand-1]",
    "profile-1",
  );

  assertEquals(result.includes("👤 CANDIDAT ACTIF: Nora Bernard"), true);
  assertEquals(result.includes("Poste: Customer Success Manager | Statut: Entretien | Score: 87/100"), true);
});

Deno.test("enrichWithPageContext enriches a contract", async () => {
  const { supabase } = makeSupabaseStub({
    contrats: {
      id: "contrat-1",
      numero: "CTR-2024-001",
      titre: "Contrat cadre",
      statut: "Signé",
      type: "SaaS",
      etablissement_id: "etab-1",
      date_debut: "2024-01-01",
      date_fin: "2024-12-31",
      signataire_nom: "Alice Martin",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CONTRATS]\n[type: contrat]\n[entity_id: contrat-1]",
    "profile-1",
  );

  assertEquals(result.includes("📑 CONTRAT ACTIF: CTR-2024-001"), true);
  assertEquals(result.includes("Statut: Signé | Type: SaaS"), true);
  assertEquals(result.includes("Période: 2024-01-01 → 2024-12-31"), true);
  assertEquals(result.includes("Établissement: [[etablissement:etab-1|voir]]"), true);
});

Deno.test("enrichWithPageContext enriches a treasury invoice only for facture type", async () => {
  const { supabase } = makeSupabaseStub({
    factures: {
      id: "fac-1",
      numero: "FAC-001",
      client_nom: "Clinique Lumière",
      montant_ttc: null,
      statut: "À payer",
      date_emission: "2024-03-01",
      date_echeance: "2024-03-31",
      etablissement_id: "etab-1",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: TRÉSORERIE]\n[type: facture]\n[entity_id: fac-1]",
    "profile-1",
  );

  assertEquals(result.includes("🧾 FACTURE ACTIVE: FAC-001 - Clinique Lumière"), true);
  assertEquals(result.includes("Montant: ?€ TTC | Statut: À payer"), true);
  assertEquals(result.includes("Émise: 2024-03-01 | Échéance: 2024-03-31"), true);

  const genericResult = await enrichWithPageContext(
    supabase as any,
    "[module: TRÉSORERIE]\n[type: tableau]\n[entity_id: fac-1]",
    "profile-1",
  );

  assertEquals(genericResult, "\n🖥️ PAGE ACTIVE: TRÉSORERIE > tableau");
});

Deno.test("enrichWithPageContext enriches a training session", async () => {
  const { supabase } = makeSupabaseStub({
    sessions_formation: {
      id: "formation-1",
      titre: "Formation administrateurs",
      date_debut: "2024-04-10",
      date_fin: "2024-04-11",
      statut: "Planifiée",
      formateur: "Jean Dupont",
      etablissement_id: "etab-1",
      lieu: "Paris",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: FORMATIONS]\n[type: session]\n[entity_id: formation-1]",
    "profile-1",
  );

  assertEquals(result.includes("🎓 SESSION FORMATION: Formation administrateurs"), true);
  assertEquals(result.includes("Statut: Planifiée | Dates: 2024-04-10 → 2024-04-11"), true);
  assertEquals(result.includes("Formateur: Jean Dupont"), true);
  assertEquals(result.includes("Lieu: Paris"), true);
  assertEquals(result.includes("Établissement: [[etablissement:etab-1|voir]]"), true);
});

Deno.test("enrichWithPageContext enriches a calendar event", async () => {
  const { supabase } = makeSupabaseStub({
    calendar_events: {
      id: "event-1",
      title: "Comité projet",
      description: "Revue mensuelle des jalons.",
      start_time: "2024-05-20T10:00:00Z",
      end_time: "2024-05-20T11:00:00Z",
      location: "Visio",
      status: "confirmed",
      etablissement_id: "etab-1",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: CALENDRIER]\n[type: event]\n[entity_id: event-1]",
    "profile-1",
  );

  assertEquals(result.includes("📅 ÉVÉNEMENT: [[event:event-1|Comité projet]]"), true);
  assertEquals(result.includes("Lieu: Visio"), true);
  assertEquals(result.includes("Description: Revue mensuelle des jalons."), true);
});

Deno.test("enrichWithPageContext enriches a document with formatted size", async () => {
  const { supabase } = makeSupabaseStub({
    documents: {
      id: "doc-1",
      nom: "Guide utilisateur.pdf",
      type: "pdf",
      taille_bytes: 2 * 1024 * 1024,
      created_at: "2024-06-01T00:00:00Z",
      etablissement_id: "etab-1",
      uploaded_by: "profile-1",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: DOCUMENTS]\n[type: fichier]\n[entity_id: doc-1]",
    "profile-1",
  );

  assertEquals(result.includes("📄 DOCUMENT: Guide utilisateur.pdf"), true);
  assertEquals(result.includes("Type: pdf | Taille: 2.0 Mo"), true);
});

Deno.test("enrichWithPageContext enriches a forum post", async () => {
  const { supabase } = makeSupabaseStub({
    forum_posts: {
      id: "post-1",
      titre: "Bonne pratique déploiement",
      contenu: "Partager les étapes clés avant le lancement client.",
      categorie: "Onboarding",
      author_id: "profile-1",
      votes_count: 12,
      comments_count: 4,
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: FORUM]\n[type: post]\n[entity_id: post-1]",
    "profile-1",
  );

  assertEquals(result.includes("💬 POST FORUM: Bonne pratique déploiement"), true);
  assertEquals(result.includes("Catégorie: Onboarding | 👍 12 | 💬 4"), true);
  assertEquals(result.includes("Partager les étapes clés avant le lancement client."), true);
});

Deno.test("enrichWithPageContext enriches a Pulse conversation", async () => {
  const { supabase } = makeSupabaseStub({
    pulse_conversations: {
      id: "pulse-1",
      title: "Point équipe support",
      type: "channel",
      created_at: "2024-07-01T00:00:00Z",
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: PULSE]\n[type: conversation]\n[entity_id: pulse-1]",
    "profile-1",
  );

  assertEquals(result.includes("💬 CONVERSATION PULSE: Point équipe support [channel]"), true);
});

Deno.test("enrichWithPageContext enriches an HR employee dossier", async () => {
  const { supabase } = makeSupabaseStub({
    profiles: {
      id: "profile-2",
      prenom: "Mehdi",
      nom: "Durand",
      email: "mehdi@example.test",
      fonction: "Product Manager",
      telephone: "0102030405",
      date_embauche: "2023-09-01",
      type_contrat: "CDI",
      actif: true,
    },
  });

  const result = await enrichWithPageContext(
    supabase as any,
    "[module: RH]\n[type: dossier]\n[entity_id: profile-2]",
    "profile-1",
  );

  assertEquals(result.includes("👤 EMPLOYÉ: Mehdi Durand"), true);
  assertEquals(result.includes("Fonction: Product Manager | Contrat: CDI | Actif: Oui"), true);
  assertEquals(result.includes("Email: mehdi@example.test"), true);
});

Deno.test("enrichWithPageContext swallows enrichment errors and preserves the active page header", async () => {
  const originalConsoleError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  const supabase = {
    from(_table: string) {
      throw new Error("database unavailable");
    },
  };

  try {
    const result = await enrichWithPageContext(
      supabase as any,
      "[module: CRM]\n[type: fiche]\n[entity_id: etab-1]",
      "profile-1",
    );

    assertEquals(result, "\n🖥️ PAGE ACTIVE: CRM > fiche");
    assertEquals(errors.length, 1);
    assertEquals(String(errors[0][0]).includes("[DynamicPageContext] Error enriching context:"), true);
  } finally {
    console.error = originalConsoleError;
  }
});

Deno.test("module exports the expected testable functions", () => {
  assertExists(parsePageContext);
  assertExists(enrichWithPageContext);
  assertEquals(typeof parsePageContext, "function");
  assertEquals(typeof enrichWithPageContext, "function");
});