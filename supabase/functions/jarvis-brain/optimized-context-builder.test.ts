import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOptimizedContext,
  getContextBudget,
  getSystemHealthStatus,
} from "./optimized-context-builder.ts";

type QueryResult = { data: unknown; error?: unknown };

class QueryStub {
  private table: string;
  private results: Record<string, unknown>;
  private shouldRejectTables: Set<string>;

  constructor(table: string, results: Record<string, unknown>, shouldRejectTables: Set<string>) {
    this.table = table;
    this.results = results;
    this.shouldRejectTables = shouldRejectTables;
  }

  select(_columns: string) {
    return this;
  }
  eq(_column: string, _value: unknown) {
    return this;
  }
  in(_column: string, _values: unknown[]) {
    return this;
  }
  order(_column: string, _opts?: unknown) {
    return this;
  }
  limit(_value: number) {
    return this;
  }
  lt(_column: string, _value: unknown) {
    return this;
  }
  not(_column: string, _operator: string, _value: unknown) {
    return this;
  }
  or(_filters: string) {
    return this;
  }
  gt(_column: string, _value: unknown) {
    return this;
  }
  gte(_column: string, _value: unknown) {
    return this;
  }
  maybeSingle() {
    if (this.shouldRejectTables.has(this.table)) {
      return Promise.reject(new Error(`forced failure for ${this.table}`));
    }
    return Promise.resolve({ data: this.results[this.table] ?? null });
  }
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this.shouldRejectTables.has(this.table)) {
      return Promise.reject(new Error(`forced failure for ${this.table}`)).then(onfulfilled, onrejected);
    }
    return Promise.resolve({ data: this.results[this.table] ?? [] }).then(onfulfilled, onrejected);
  }
}

function createSupabaseStub(
  results: Record<string, unknown>,
  shouldRejectTables: string[] = [],
) {
  const rejectSet = new Set(shouldRejectTables);
  return {
    from(table: string) {
      return new QueryStub(table, results, rejectSet);
    },
  };
}

Deno.test("getContextBudget retourne les limites HEALTHY attendues", () => {
  const budget = getContextBudget("HEALTHY");
  assertEquals(budget.teamLimit, 15);
  assertEquals(budget.tasksLimit, 12);
  assertEquals(budget.overdueTasksLimit, 5);
  assertEquals(budget.establishmentsLimit, 10);
  assertEquals(budget.emailsLimit, 8);
  assertEquals(budget.eventsLimit, 6);
  assertEquals(budget.ticketsLimit, 5);
  assertEquals(budget.groupsLimit, 8);
  assertEquals(budget.partnersLimit, 8);
  assertEquals(budget.devisLimit, 5);
  assertEquals(budget.avoirsLimit, 3);
  assertEquals(budget.forumLimit, 3);
  assertEquals(budget.csmAlertsLimit, 5);
});

Deno.test("getContextBudget retourne les limites OFFLINE attendues", () => {
  const budget = getContextBudget("OFFLINE");
  assertEquals(budget.teamLimit, 0);
  assertEquals(budget.tasksLimit, 3);
  assertEquals(budget.overdueTasksLimit, 2);
  assertEquals(budget.establishmentsLimit, 0);
  assertEquals(budget.emailsLimit, 0);
  assertEquals(budget.eventsLimit, 0);
  assertEquals(budget.ticketsLimit, 0);
  assertEquals(budget.groupsLimit, 0);
  assertEquals(budget.partnersLimit, 0);
  assertEquals(budget.devisLimit, 0);
  assertEquals(budget.avoirsLimit, 0);
  assertEquals(budget.forumLimit, 0);
  assertEquals(budget.csmAlertsLimit, 0);
});

Deno.test("getSystemHealthStatus retourne HEALTHY si aucun état n'est trouvé", async () => {
  const supabase = createSupabaseStub({
    jarvis_circuit_state: null,
  });

  const status = await getSystemHealthStatus(supabase as never);
  assertEquals(status, "HEALTHY");
});

Deno.test("getSystemHealthStatus mappe OPEN vers UNHEALTHY", async () => {
  const supabase = createSupabaseStub({
    jarvis_circuit_state: { state: "OPEN" },
  });

  const status = await getSystemHealthStatus(supabase as never);
  assertEquals(status, "UNHEALTHY");
});

Deno.test("getSystemHealthStatus mappe HALF_OPEN vers DEGRADED", async () => {
  const supabase = createSupabaseStub({
    jarvis_circuit_state: { state: "HALF_OPEN" },
  });

  const status = await getSystemHealthStatus(supabase as never);
  assertEquals(status, "DEGRADED");
});

Deno.test("getSystemHealthStatus retourne HEALTHY sur erreur de requête", async () => {
  const supabase = createSupabaseStub({}, ["jarvis_circuit_state"]);

  const status = await getSystemHealthStatus(supabase as never);
  assertEquals(status, "HEALTHY");
});

Deno.test("buildOptimizedContext retourne une chaîne vide en mode OFFLINE", async () => {
  const supabase = createSupabaseStub({});

  const context = await buildOptimizedContext(supabase as never, "profile-offline", "OFFLINE");
  assertEquals(context, "");
});

Deno.test("buildOptimizedContext construit un contexte riche avec tâches, équipe et établissements", async () => {
  const profileId = "p1";
  const supabase = createSupabaseStub({
    profiles: [
      {
        id: "u1",
        prenom: "Alice",
        nom: "Martin",
        email: "alice@example.test",
        fonction: "CSM",
      },
      {
        id: "u2",
        prenom: "Bob",
        nom: "Durand",
        email: "bob@example.test",
        fonction: null,
      },
    ],
    taches: [
      {
        id: "t1",
        titre: "Préparer le dossier client",
        statut: "A faire",
        priorite: "haute",
        echeance: "2026-06-20T10:00:00.000Z",
      },
      {
        id: "t2",
        titre: "Relancer le prospect",
        statut: "En cours",
        priorite: "basse",
        echeance: null,
      },
    ],
    etablissements: [
      {
        id: "e1",
        nom: "Clinique du Lac",
        ville: "Annecy",
        statut: "Actif",
        commercial_id: profileId,
        chef_projet_id: null,
        csm_id: profileId,
      },
      {
        id: "e2",
        nom: "Centre Médical Nord",
        ville: null,
        statut: "Déploiement",
        commercial_id: null,
        chef_projet_id: profileId,
        csm_id: null,
      },
    ],
    email_threads: [
      {
        id: "m1",
        subject: "Question contrat",
        ai_generated_title: "Contrat à valider",
      },
    ],
    calendar_events: [
      {
        id: "ev1",
        title: "Point hebdo",
        start_time: "2026-06-21T09:00:00.000Z",
      },
    ],
    support_tickets: [
      {
        id: "s1",
        titre: "Erreur impression",
        priority: "high",
      },
    ],
    groupes_etablissements: [
      { id: "g1", nom: "Groupe Santé Sud" },
    ],
    partenaires: [
      { id: "pa1", nom: "Partenaire X" },
    ],
    devis: [
      {
        id: "d1",
        numero: "DEV-001",
        client_nom: "Clinique du Lac",
        objet: "Extension",
        montant_ttc: 1200,
        statut: "envoye",
      },
    ],
    avoirs: [
      {
        id: "a1",
        numero: "AV-001",
        client_nom: "Clinique du Lac",
        montant_ttc: 150,
        statut: "valide",
      },
    ],
    forum_posts: [
      {
        id: "f1",
        titre: "Nouvelle procédure",
        categorie: "Process",
      },
    ],
    csm_sante_comptes: [
      {
        id: "c1",
        etablissement_id: "e1",
        score_global: 42,
        niveau_risque: "critique",
      },
    ],
    factures: [
      {
        id: "fac1",
        numero: "F-001",
        client_nom: "Clinique du Lac",
        montant_ttc: 900,
        date_echeance: "2026-06-19",
        statut: "en_retard",
      },
    ],
    sessions_formation: [
      {
        id: "tr1",
        titre: "Formation SIRH",
        date_debut: "2026-06-22T13:00:00.000Z",
        etablissement_id: "e1",
      },
    ],
  });

  const context = await buildOptimizedContext(supabase as never, profileId, "HEALTHY");

  assertExists(context);
  assertEquals(typeof context, "string");
  assertEquals(context.includes("👥 ÉQUIPE (2):"), true);
  assertEquals(context.includes("Alice Martin <alice@example.test> - CSM"), true);
  assertEquals(context.includes("Bob Durand <bob@example.test>"), true);
  assertEquals(context.includes("📋 TÂCHES (2):"), true);
  assertEquals(context.includes("[t1]"), true);
  assertEquals(context.includes("Préparer le dossier client"), true);
  assertEquals(context.includes("📝 Pour référencer une tâche, utilise: [[task:ID|titre]]"), true);
  assertEquals(context.includes("🏥 ÉTABLISSEMENTS (2):"), true);
  assertEquals(context.includes("[e1]Clinique du Lac (Annecy) [Commercial, CSM]"), true);
  assertEquals(context.includes("[e2]Centre Médical Nord [Chef de projet]"), true);
  assertEquals(context.includes("📝 Pour référencer un établissement, utilise: [[etablissement:ID|nom]]"), true);
});

Deno.test("buildOptimizedContext utilise le cache pour un même profil et état de santé", async () => {
  const profileId = "cache-profile";
  let profilesCalls = 0;

  const supabase = {
    from(table: string) {
      return new class extends QueryStub {
        constructor() {
          super(table, {
            profiles: [
              {
                id: "u1",
                prenom: "Cache",
                nom: "User",
                email: "cache@example.test",
                fonction: "Ops",
              },
            ],
            taches: [],
            etablissements: [],
            email_threads: [],
            calendar_events: [],
            support_tickets: [],
            groupes_etablissements: [],
            partenaires: [],
            devis: [],
            avoirs: [],
            forum_posts: [],
            csm_sante_comptes: [],
            factures: [],
            sessions_formation: [],
          }, new Set());
        }
        override then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): Promise<TResult1 | TResult2> {
          if (table === "profiles") profilesCalls++;
          return Promise.resolve({
            data: table === "profiles"
              ? [{
                id: "u1",
                prenom: "Cache",
                nom: "User",
                email: "cache@example.test",
                fonction: "Ops",
              }]
              : [],
          }).then(onfulfilled, onrejected);
        }
      }();
    },
  };

  const first = await buildOptimizedContext(supabase as never, profileId, "HEALTHY");
  const second = await buildOptimizedContext(supabase as never, profileId, "HEALTHY");

  assertEquals(first, second);
  assertEquals(profilesCalls, 1);
});

Deno.test("buildOptimizedContext retourne une chaîne vide si une requête échoue", async () => {
  const supabase = createSupabaseStub(
    {
      profiles: [],
      taches: [],
      etablissements: [],
      email_threads: [],
      calendar_events: [],
      support_tickets: [],
      groupes_etablissements: [],
      partenaires: [],
      devis: [],
      avoirs: [],
      forum_posts: [],
      csm_sante_comptes: [],
      factures: [],
      sessions_formation: [],
    },
    ["profiles"],
  );

  const context = await buildOptimizedContext(supabase as never, "profile-error", "HEALTHY");
  assertEquals(context, "");
});

Deno.test("le module se charge sans throw", async () => {
  const mod = await import("./optimized-context-builder.ts");
  assertExists(mod);
});