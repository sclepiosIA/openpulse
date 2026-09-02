import { PUBLIC_EMARGEMENT_URL, buildEmargementUrl } from "./emargementUrl";

describe("emargementUrl", () => {
  it("expose l'URL publique institutionnelle d'émargement", () => {
    expect(PUBLIC_EMARGEMENT_URL).toBe("https://exploitant.example.org/emargement");
  });

  it.each([
    ["aucun paramètre", undefined],
    ["objet vide", {}],
    ["session vide", { sessionId: "" }],
    ["token null", { token: null }],
    ["token vide", { token: "" }],
    ["session et token absents", { sessionId: "", token: null }],
  ] as const)("retourne l'URL publique sans query string quand %s", (_label, params) => {
    expect(buildEmargementUrl(params)).toBe(PUBLIC_EMARGEMENT_URL);
  });

  it.each([
    [
      "session seule",
      { sessionId: "s1" },
      "https://exploitant.example.org/emargement?session=s1",
    ],
    [
      "token seul",
      { token: "tok" },
      "https://exploitant.example.org/emargement?token=tok",
    ],
    [
      "session et token",
      { sessionId: "s1", token: "tok" },
      "https://exploitant.example.org/emargement?session=s1&token=tok",
    ],
    [
      "valeurs encodées",
      { sessionId: "s 1", token: "t/1" },
      "https://exploitant.example.org/emargement?session=s+1&token=t%2F1",
    ],
  ] as const)("construit l'URL avec %s", (_label, params, expectedUrl) => {
    expect(buildEmargementUrl(params)).toBe(expectedUrl);
  });

  it("conserve uniquement le token quand la session est absente", () => {
    const url = new URL(buildEmargementUrl({ sessionId: "", token: "tok" }));

    expect(url.origin + url.pathname).toBe(PUBLIC_EMARGEMENT_URL);
    expect(url.searchParams.get("session")).toBeNull();
    expect(url.searchParams.get("token")).toBe("tok");
  });

  it("conserve uniquement la session quand le token est null", () => {
    const url = new URL(buildEmargementUrl({ sessionId: "s1", token: null }));

    expect(url.origin + url.pathname).toBe(PUBLIC_EMARGEMENT_URL);
    expect(url.searchParams.get("session")).toBe("s1");
    expect(url.searchParams.get("token")).toBeNull();
  });
});