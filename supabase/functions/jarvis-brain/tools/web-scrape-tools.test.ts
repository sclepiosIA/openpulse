import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeWebScrape, executeWebSearchFree } from "./web-scrape-tools.ts";

const ctx = {} as any;

function restoreEnv(key: string, previous: string | undefined) {
  if (previous === undefined) {
    Deno.env.delete(key);
  } else {
    Deno.env.set(key, previous);
  }
}

Deno.test("executeWebScrape fails when Supabase environment variables are missing", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}"));
    }) as typeof fetch;

    const result = await executeWebScrape(ctx, {
      url: "https://example.test/article",
    });

    assertEquals(result.success, false);
    assertEquals(fetchCalled, false);
    assertEquals(
      result.error,
      "❌ **Échec du scraping**\n\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    assertExists(result.execution_time_ms);
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebScrape posts expected payload, applies defaults, and limits links/images", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("SUPABASE_URL", "https://supabase.local");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-token");

    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const links = Array.from({ length: 55 }, (_, index) => ({
      href: `https://example.test/link-${index + 1}`,
      text: `Link ${index + 1}`,
    }));
    const images = Array.from({ length: 25 }, (_, index) => ({
      src: `https://example.test/image-${index + 1}.png`,
      alt: `Image ${index + 1}`,
    }));

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            url: "https://example.test/article",
            title: "Article test",
            wordCount: 123,
            text: "Contenu extrait",
            markdown: "# Article test",
            html: "<main>Contenu extrait</main>",
            links,
            images,
            metadata: {
              description: "Description métier",
              author: "JARVIS",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof fetch;

    const result = await executeWebScrape(ctx, {
      url: "https://example.test/article",
    });

    assertEquals(capturedUrl, "https://supabase.local/functions/v1/jarvis-web-scrape");
    assertEquals(capturedInit?.method, "POST");
    assertEquals((capturedInit?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals(
      (capturedInit?.headers as Record<string, string>)["Authorization"],
      "Bearer service-role-test-token",
    );

    assertEquals(JSON.parse(capturedInit?.body as string), {
      url: "https://example.test/article",
      formats: ["text", "metadata"],
      maxLength: 30000,
    });

    assertEquals(result.success, true);
    assertExists(result.data);

    const data = result.data as any;
    assertEquals(data.url, "https://example.test/article");
    assertEquals(data.title, "Article test");
    assertEquals(data.wordCount, 123);
    assertEquals(data.text, "Contenu extrait");
    assertEquals(data.markdown, "# Article test");
    assertEquals(data.html, "<main>Contenu extrait</main>");
    assertEquals(data.metadata, {
      description: "Description métier",
      author: "JARVIS",
    });
    assertEquals(data.links.length, 50);
    assertEquals(data.totalLinks, 55);
    assertEquals(data.links[0], {
      href: "https://example.test/link-1",
      text: "Link 1",
    });
    assertEquals(data.links[49], {
      href: "https://example.test/link-50",
      text: "Link 50",
    });
    assertEquals(data.images.length, 20);
    assertEquals(data.totalImages, 25);
    assertEquals(data.images[19], {
      src: "https://example.test/image-20.png",
      alt: "Image 20",
    });
    assertExists(result.execution_time_ms);
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebScrape forwards explicit options to the Edge Function", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("SUPABASE_URL", "https://supabase.local");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-token");

    let requestBody: any;

    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(init?.body as string);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            url: requestBody.url,
            title: "Page ciblée",
            wordCount: 7,
            text: "Texte ciblé",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof fetch;

    const result = await executeWebScrape(ctx, {
      url: "https://example.test/products",
      formats: ["markdown", "links"],
      maxLength: 2048,
      selector: "main.article",
      includeImages: true,
    });

    assertEquals(requestBody, {
      url: "https://example.test/products",
      formats: ["markdown", "links"],
      maxLength: 2048,
      selector: "main.article",
      includeImages: true,
    });
    assertEquals(result.success, true);
    assertEquals((result.data as any).title, "Page ciblée");
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebScrape returns service error when scraper response is unsuccessful", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("SUPABASE_URL", "https://supabase.local");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-token");

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: "URL inaccessible",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )) as typeof fetch;

    const result = await executeWebScrape(ctx, {
      url: "https://example.test/missing",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "URL inaccessible");
    assertExists(result.execution_time_ms);
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebSearchFree parses DuckDuckGo Lite result-link entries and caps maxResults to 20", async () => {
  const originalFetch = globalThis.fetch;

  try {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;

    const html = Array.from({ length: 25 }, (_, index) => {
      const n = index + 1;
      return `
        <tr>
          <td>
            <a class="result-link" href="https://result.test/${n}">Résultat ${n}</a>
          </td>
        </tr>
        <tr>
          <td class="result-snippet">
            Extrait <b>important</b> numéro ${n} avec un texte utile pour vérifier le parsing.
          </td>
        </tr>
      `;
    }).join("\n");

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;

      return Promise.resolve(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    }) as typeof fetch;

    const result = await executeWebSearchFree(ctx, {
      query: "Deno TypeScript tests",
      maxResults: 25,
      region: "fr-fr",
    });

    assertEquals(
      capturedUrl,
      "https://lite.duckduckgo.com/lite/?q=Deno%20TypeScript%20tests&kl=fr-fr",
    );
    assertEquals((capturedHeaders as Record<string, string>)["Accept"], "text/html");
    assertEquals(
      (capturedHeaders as Record<string, string>)["User-Agent"],
      "Mozilla/5.0 (compatible; Jarvis-Bot/1.0)",
    );

    assertEquals(result.success, true);
    assertEquals((result.data as any).query, "Deno TypeScript tests");
    assertEquals((result.data as any).source, "DuckDuckGo (free)");
    assertEquals((result.data as any).resultCount, 20);
    assertEquals((result.data as any).results.length, 20);
    assertEquals((result.data as any).results[0], {
      title: "Résultat 1",
      url: "https://result.test/1",
      snippet: "Extrait important numéro 1 avec un texte utile pour vérifier le parsing.",
    });
    assertEquals((result.data as any).results[19].title, "Résultat 20");
    assertEquals((result.data as any).results[19].url, "https://result.test/20");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebSearchFree uses default region and maxResults when options are omitted", async () => {
  const originalFetch = globalThis.fetch;

  try {
    let capturedUrl = "";

    const html = `
      <a class="result-link" href="https://deno.land/">Deno</a>
      <td class="result-snippet">Runtime JavaScript, TypeScript et WebAssembly.</td>
    `;

    globalThis.fetch = ((input: RequestInfo | URL) => {
      capturedUrl = String(input);

      return Promise.resolve(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    }) as typeof fetch;

    const result = await executeWebSearchFree(ctx, {
      query: "deno runtime",
    });

    assertEquals(capturedUrl, "https://lite.duckduckgo.com/lite/?q=deno%20runtime&kl=fr-fr");
    assertEquals(result.success, true);
    assertEquals((result.data as any).resultCount, 1);
    assertEquals((result.data as any).results[0], {
      title: "Deno",
      url: "https://deno.land/",
      snippet: "Runtime JavaScript, TypeScript et WebAssembly.",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebSearchFree falls back to nofollow links when primary parser finds no result", async () => {
  const originalFetch = globalThis.fetch;

  try {
    const html = `
      <html>
        <body>
          <a href="https://duckduckgo.com/settings" rel="nofollow">Internal</a>
          <a href="https://example.test/a" rel="nofollow">Alpha result</a>
          <a href="https://example.test/b" rel="nofollow">Beta result</a>
        </body>
      </html>
    `;

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )) as typeof fetch;

    const result = await executeWebSearchFree(ctx, {
      query: "fallback parser",
      maxResults: 5,
    });

    assertEquals(result.success, true);
    assertEquals((result.data as any).resultCount, 2);
    assertEquals((result.data as any).results, [
      {
        title: "Alpha result",
        url: "https://example.test/a",
        snippet: "",
      },
      {
        title: "Beta result",
        url: "https://example.test/b",
        snippet: "",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWebSearchFree returns a formatted failure on non-OK HTTP response", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response("Service unavailable", {
          status: 503,
          headers: { "content-type": "text/html" },
        }),
      )) as typeof fetch;

    const result = await executeWebSearchFree(ctx, {
      query: "temporary outage",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "❌ **Échec de la recherche**\n\nSearch failed: HTTP 503");
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
  }
});