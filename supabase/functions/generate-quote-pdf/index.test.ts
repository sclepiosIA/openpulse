import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type QuoteHtmlBuilder = (devis: Record<string, unknown> | null) => string;

function buildInternalModuleSource(source: string): string {
  const companyStart = source.indexOf("const COMPANY_INFO");
  if (companyStart === -1) {
    throw new Error("COMPANY_INFO declaration not found");
  }

  const companyEnd = source.indexOf("};", companyStart);
  if (companyEnd === -1) {
    throw new Error("COMPANY_INFO declaration end not found");
  }

  const functionStart = source.indexOf("function generateQuoteHtml");
  if (functionStart === -1) {
    throw new Error("generateQuoteHtml declaration not found");
  }

  return `${source.slice(companyStart, companyEnd + 2)}

${source.slice(functionStart)}

export { generateQuoteHtml };
`;
}

let quoteHtmlBuilderPromise: Promise<QuoteHtmlBuilder> | undefined;

async function loadQuoteHtmlBuilder(): Promise<QuoteHtmlBuilder> {
  if (!quoteHtmlBuilderPromise) {
    quoteHtmlBuilderPromise = (async () => {
      const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
      const moduleSource = buildInternalModuleSource(source);
      const tempDir = await Deno.makeTempDir();
      const tempFile = `${tempDir}/quote_html_internals_${crypto.randomUUID()}.ts`;

      await Deno.writeTextFile(tempFile, moduleSource);

      try {
        const mod = await import(`file://${tempFile}?v=${crypto.randomUUID()}`);
        assertExists(mod.generateQuoteHtml);
        return mod.generateQuoteHtml as QuoteHtmlBuilder;
      } finally {
        await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      }
    })();
  }

  return quoteHtmlBuilderPromise;
}

const eur = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

Deno.test("module loads without opening a real network listener", async () => {
  const originalListenDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const originalListen = Deno.listen;
  const listenCalls: Deno.ListenOptions[] = [];

  const fakeListen = ((options: Deno.ListenOptions): Deno.Listener => {
    listenCalls.push(options);

    return {
      rid: 123456,
      addr: {
        transport: "tcp",
        hostname: options.hostname ?? "0.0.0.0",
        port: options.port ?? 8000,
      },
      accept: () => new Promise<Deno.Conn>(() => {}),
      close: () => {},
      ref: () => {},
      unref: () => {},
      [Symbol.asyncIterator]() {
        return {
          next: () => Promise.resolve({ done: true, value: undefined }),
        };
      },
    } as unknown as Deno.Listener;
  }) as typeof Deno.listen;

  try {
    Object.defineProperty(Deno, "listen", {
      ...(originalListenDescriptor ?? { configurable: true, writable: true }),
      value: fakeListen,
    });

    const mod = await import("./index.ts");
    assertExists(mod);
    assertEquals(listenCalls.length, 1);
  } finally {
    Object.defineProperty(Deno, "listen", {
      ...(originalListenDescriptor ?? { configurable: true, writable: true }),
      value: originalListen,
    });
  }
});

Deno.test("generateQuoteHtml renders quote identity, company, client, lines and totals", async () => {
  const generateQuoteHtml = await loadQuoteHtmlBuilder();

  const html = generateQuoteHtml({
    numero: "DEV-2024-001",
    client_nom: "Clinique du Parc",
    client_adresse: "8 rue des Lilas, 69002 Lyon",
    client_siret: "987 654 321 00045",
    client_email: "achats@clinique.example",
    client_telephone: "+33 1 02 03 04 05",
    date_emission: "2024-03-05T00:00:00",
    date_validite: "2024-04-05T00:00:00",
    montant_ht: 2500,
    montant_tva: 500,
    remise_globale_montant: 100,
    montant_ttc: 2900,
    conditions_paiement: "Paiement à 30 jours fin de mois.",
    notes_client: "Inclut un atelier de cadrage.",
    lignes: [
      {
        designation: "Audit IA réglementaire",
        description: "Cartographie des processus et risques.",
        quantite: 2,
        unite: "jour",
        prix_unitaire_ht: 1000,
        taux_tva: 20,
        montant_ht: 2000,
      },
      {
        designation: "Atelier conformité",
        quantite: 1,
        unite: "session",
        prix_unitaire_ht: 500,
        taux_tva: 20,
        montant_ht: 500,
      },
    ],
  });

  assertEquals(html.includes("<title>Devis DEV-2024-001</title>"), true);
  assertEquals(html.includes("OPENPULSE IA"), true);
  assertEquals(html.includes("N° DEV-2024-001"), true);
  assertEquals(html.includes("Clinique du Parc"), true);
  assertEquals(html.includes("8 rue des Lilas, 69002 Lyon"), true);
  assertEquals(html.includes("SIRET: 987 654 321 00045"), true);
  assertEquals(html.includes("Email: achats@clinique.example"), true);
  assertEquals(html.includes("Tél: +33 1 02 03 04 05"), true);
  assertEquals(html.includes("05/03/2024"), true);
  assertEquals(html.includes("05/04/2024"), true);
  assertEquals(html.includes("Audit IA réglementaire"), true);
  assertEquals(html.includes("Cartographie des processus et risques."), true);
  assertEquals(html.includes("Atelier conformité"), true);
  assertEquals(html.includes("2 jour"), true);
  assertEquals(html.includes("1 session"), true);
  assertEquals(html.includes(eur(1000)), true);
  assertEquals(html.includes(eur(500)), true);
  assertEquals(html.includes(eur(2500)), true);
  assertEquals(html.includes(eur(500)), true);
  assertEquals(html.includes(`-${eur(100)}`), true);
  assertEquals(html.includes(eur(2900)), true);
  assertEquals(html.includes("Paiement à 30 jours fin de mois."), true);
  assertEquals(html.includes("Inclut un atelier de cadrage."), true);
});

Deno.test("generateQuoteHtml renders empty-line fallback and omits absent optional sections", async () => {
  const generateQuoteHtml = await loadQuoteHtmlBuilder();

  const html = generateQuoteHtml({
    numero: "DEV-EMPTY",
    client_nom: "Association Horizon",
    date_emission: "2024-01-10T00:00:00",
    date_validite: "2024-02-10T00:00:00",
    montant_ht: undefined,
    montant_tva: null,
    montant_ttc: 0,
  });

  assertEquals(html.includes("DEV-EMPTY"), true);
  assertEquals(html.includes("Association Horizon"), true);
  assertEquals(html.includes("Aucune ligne"), true);
  assertEquals(html.includes(eur(0)), true);
  assertEquals(html.includes("Conditions de paiement"), false);
  assertEquals(html.includes("📝 Notes"), false);
  assertEquals(html.includes("undefined"), false);
  assertEquals(html.includes("null"), false);
});

Deno.test("generateQuoteHtml defaults missing VAT rate to 20 percent and omits absent descriptions", async () => {
  const generateQuoteHtml = await loadQuoteHtmlBuilder();

  const html = generateQuoteHtml({
    numero: "DEV-LINE-DEFAULTS",
    client_nom: "Laboratoire Nova",
    date_emission: "2024-06-01T00:00:00",
    date_validite: "2024-06-30T00:00:00",
    montant_ht: 99,
    montant_tva: 19.8,
    montant_ttc: 118.8,
    lignes: [
      {
        designation: "Licence OpenPulse",
        quantite: 1,
        prix_unitaire_ht: 99,
        montant_ht: 99,
      },
    ],
  });

  assertEquals(html.includes("Licence OpenPulse"), true);
  assertEquals(html.includes("20%"), true);
  assertEquals(html.includes(eur(99)), true);
  assertEquals(html.includes(eur(118.8)), true);
  assertEquals(html.includes('<small style="color: #6b7280;">'), false);
  assertEquals(html.includes("undefined"), false);
});

Deno.test("generateQuoteHtml rejects null devis input", async () => {
  const generateQuoteHtml = await loadQuoteHtmlBuilder();

  assertThrows(
    () => generateQuoteHtml(null),
    TypeError,
  );
});

Deno.test("internal test extraction fails when expected pure builder is absent", async () => {
  await assertRejects(
    async () => {
      await Promise.resolve(buildInternalModuleSource("const COMPANY_INFO = {};\n"));
    },
    Error,
    "generateQuoteHtml",
  );
});