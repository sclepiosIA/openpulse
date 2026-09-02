import {
  COPILOT_ACTIONS,
  COPILOT_GROUP_LABEL,
  TRANSLATE_LANGUAGES,
  getActionsForSurface,
  getActionById,
} from "./actions";
import type { CopilotAction, CopilotSurface } from "./actions";

describe("COPILOT_ACTIONS", () => {
  it("contient exactement 28 actions", () => {
    expect(COPILOT_ACTIONS).toHaveLength(28);
  });

  it("a des ids uniques", () => {
    const ids = COPILOT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque action a les clés obligatoires avec les bons types", () => {
    for (const action of COPILOT_ACTIONS) {
      expect(typeof action.id).toBe("string");
      expect(action.id.length).toBeGreaterThan(0);
      expect(typeof action.label).toBe("string");
      expect(action.label.length).toBeGreaterThan(0);
      expect(typeof action.description).toBe("string");
      expect(typeof action.needsSelection).toBe("boolean");
      expect(action.icon).toBeDefined();
      expect(Array.isArray(action.surfaces)).toBe(true);
      expect(action.surfaces.length).toBeGreaterThan(0);
    }
  });

  it("chaque groupe utilisé est présent dans COPILOT_GROUP_LABEL", () => {
    const groups = new Set(COPILOT_ACTIONS.map((a) => a.group));
    for (const group of groups) {
      expect(COPILOT_GROUP_LABEL[group]).toBeDefined();
    }
  });

  it("la première action est 'rewrite' avec les bonnes valeurs", () => {
    const first = COPILOT_ACTIONS[0];
    expect(first.id).toBe("rewrite");
    expect(first.label).toBe("Réécrire");
    expect(first.description).toBe("Améliorer la fluidité en conservant le sens");
    expect(first.group).toBe("rewrite");
    expect(first.needsSelection).toBe(true);
    expect(first.surfaces).toEqual(["document"]);
  });

  it("la dernière action est 'insights' du groupe spreadsheet", () => {
    const last = COPILOT_ACTIONS[COPILOT_ACTIONS.length - 1];
    expect(last.id).toBe("insights");
    expect(last.label).toBe("Insights");
    expect(last.group).toBe("spreadsheet");
    expect(last.needsSelection).toBe(false);
    expect(last.structured).toBe(true);
    expect(last.surfaces).toEqual(["spreadsheet"]);
  });

  it("'continue_writing' a le raccourci Tab et insertAtCursor", () => {
    const action = COPILOT_ACTIONS.find((a) => a.id === "continue_writing");
    expect(action).toBeDefined();
    expect(action?.shortcut).toBe("Tab");
    expect(action?.insertAtCursor).toBe(true);
    expect(action?.needsSelection).toBe(false);
    expect(action?.group).toBe("generate");
  });

  it("les actions extract sont toutes structurées et sans sélection", () => {
    const extract = COPILOT_ACTIONS.filter((a) => a.group === "extract");
    expect(extract).toHaveLength(3);
    expect(extract.map((a) => a.id)).toEqual([
      "extract_actions",
      "extract_events",
      "extract_contacts",
    ]);
    for (const a of extract) {
      expect(a.structured).toBe(true);
      expect(a.needsSelection).toBe(false);
    }
  });

  it("les surfaces sont valides", () => {
    const valid: CopilotSurface[] = ["document", "presentation", "spreadsheet"];
    for (const action of COPILOT_ACTIONS) {
      for (const surface of action.surfaces) {
        expect(valid).toContain(surface);
      }
    }
  });
});

describe("COPILOT_GROUP_LABEL", () => {
  it("contient exactement les 7 groupes attendus", () => {
    expect(Object.keys(COPILOT_GROUP_LABEL).sort()).toEqual(
      ["convert", "extract", "generate", "rewrite", "spreadsheet", "tone", "translate"].sort()
    );
  });

  it.each([
    ["rewrite", "Réécrire"],
    ["tone", "Changer le ton"],
    ["translate", "Traduire"],
    ["generate", "Générer"],
    ["convert", "Convertir"],
    ["extract", "Extraire"],
    ["spreadsheet", "Tableur"],
  ] as [CopilotAction["group"], string][])("mappe %s → %s", (group, label) => {
    expect(COPILOT_GROUP_LABEL[group]).toBe(label);
  });
});

describe("TRANSLATE_LANGUAGES", () => {
  it("contient exactement 8 langues", () => {
    expect(TRANSLATE_LANGUAGES).toHaveLength(8);
  });

  it("a des codes uniques de 2 caractères", () => {
    const codes = TRANSLATE_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z]{2}$/);
    }
  });

  it("commence par l'anglais et finit par le français", () => {
    expect(TRANSLATE_LANGUAGES[0]).toEqual({ code: "en", label: "Anglais" });
    expect(TRANSLATE_LANGUAGES[TRANSLATE_LANGUAGES.length - 1]).toEqual({
      code: "fr",
      label: "Français",
    });
  });

  it("contient l'arabe et le portugais", () => {
    expect(TRANSLATE_LANGUAGES).toContainEqual({ code: "ar", label: "Arabe" });
    expect(TRANSLATE_LANGUAGES).toContainEqual({ code: "pt", label: "Portugais" });
  });
});

describe("getActionsForSurface", () => {
  it("retourne 24 actions pour 'document'", () => {
    const actions = getActionsForSurface("document");
    expect(actions).toHaveLength(24);
    for (const a of actions) {
      expect(a.surfaces).toContain("document");
    }
  });

  it("retourne 4 actions pour 'spreadsheet'", () => {
    const actions = getActionsForSurface("spreadsheet");
    expect(actions.map((a) => a.id)).toEqual([
      "formula_from_nl",
      "explain_formula",
      "fix_formula",
      "insights",
    ]);
  });

  it("retourne un tableau vide pour 'presentation'", () => {
    expect(getActionsForSurface("presentation")).toEqual([]);
  });

  it("exclut les actions spreadsheet du surface document", () => {
    const actions = getActionsForSurface("document");
    expect(actions.some((a) => a.group === "spreadsheet")).toBe(false);
  });
});

describe("getActionById", () => {
  it.each([
    ["rewrite", "Réécrire"],
    ["translate", "Traduire"],
    ["summarize_tldr", "TL;DR"],
    ["fix_formula", "Réparer la formule"],
  ])("retrouve l'action '%s' avec le label '%s'", (id, label) => {
    const action = getActionById(id);
    expect(action).toBeDefined();
    expect(action?.id).toBe(id);
    expect(action?.label).toBe(label);
  });

  it("retourne undefined pour un id inconnu", () => {
    expect(getActionById("unknown_action")).toBeUndefined();
    expect(getActionById("")).toBeUndefined();
  });

  it("retourne la même référence que dans COPILOT_ACTIONS", () => {
    const action = getActionById("proofread");
    expect(action).toBe(COPILOT_ACTIONS.find((a) => a.id === "proofread"));
  });
});