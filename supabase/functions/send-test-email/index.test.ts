import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

const MODULE_DIR = decodeURIComponent(new URL('.', import.meta.url).pathname)
const MODULE_INDEX_URL = new URL('./index.ts', import.meta.url).href
const SHARED_ERROR_SANITIZER_URL = new URL('../_shared/error-sanitizer.ts', import.meta.url).href
const SHARED_EMAIL_CONFIG_URL = new URL('../_shared/email-sender-config.ts', import.meta.url).href

function fileUrl(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  return new URL(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`).href
}

// Le harnais isole chaque scénario dans un subprocess `deno run`
// (Deno.Command + Deno.execPath()), ce qui exige la permission `run`.
// Certains runners lancent `deno test` sans `--allow-run` (ex. entrypoint
// Azure : --allow-net --allow-env --allow-read --allow-write --no-check) :
// on marque alors les tests `ignore` plutôt que de les laisser échouer en
// NotCapable. Ils s'exécutent pleinement dès que `--allow-run` est accordé
// (deno task test, CI GitHub _shared, RUN_ARGS runner).
const hasRunPermission = (await Deno.permissions.query({ name: 'run' })).state === 'granted'

function testWithRunPermission(name: string, fn: () => Promise<void>): void {
  Deno.test({ name, ignore: !hasRunPermission, fn })
}

async function runIsolatedScenario(scenarioSource: string) {
  const tempDir = await Deno.makeTempDir({ prefix: 'send_test_email_test_' })

  const previousEnv = {
    RESEND_API_KEY: Deno.env.get('RESEND_API_KEY'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }

  try {
    Deno.env.set('RESEND_API_KEY', 'test-resend-key')
    Deno.env.set('SUPABASE_URL', 'https://supabase.example.test')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

    const serveStubPath = `${tempDir}/serve_stub.ts`
    const supabaseStubPath = `${tempDir}/supabase_stub.ts`
    const resendStubPath = `${tempDir}/resend_stub.ts`
    const errorSanitizerStubPath = `${tempDir}/error_sanitizer_stub.ts`
    const emailConfigStubPath = `${tempDir}/email_config_stub.ts`
    const importMapPath = `${tempDir}/import_map.json`
    const runnerPath = `${tempDir}/runner.ts`

    await Deno.writeTextFile(
      serveStubPath,
      `
export function serve(handler) {
  globalThis.__sendTestEmailHandler = handler;
  return {
    finished: Promise.resolve(),
    shutdown() {},
  };
}
`
    )

    await Deno.writeTextFile(
      supabaseStubPath,
      `
export function createClient(url, key) {
  globalThis.__supabaseConfig = { url, key };
  return {
    auth: {
      getUser: async (jwt) => {
        globalThis.__jwt = jwt;
        if (globalThis.__userError) {
          return { data: { user: null }, error: { message: "invalid jwt" } };
        }
        return {
          data: { user: { id: globalThis.__userId ?? "user-123" } },
          error: null,
        };
      },
    },
    rpc: async (name, args) => {
      globalThis.__rpcCall = { name, args };
      if (globalThis.__roleError) {
        return { data: null, error: { message: "role lookup failed" } };
      }
      return { data: globalThis.__isStrictAdmin ?? true, error: null };
    },
  };
}
`
    )

    await Deno.writeTextFile(
      resendStubPath,
      `
export class Resend {
  constructor(apiKey) {
    globalThis.__resendApiKey = apiKey;
    this.emails = {
      send: async (payload) => {
        globalThis.__lastEmailPayload = payload;
        if (globalThis.__resendError) {
          throw new Error(globalThis.__resendError);
        }
        return { data: { id: globalThis.__messageId ?? "msg_test_123" } };
      },
    };
  }
}
`
    )

    await Deno.writeTextFile(
      errorSanitizerStubPath,
      `
export function buildErrorResponse(scope, error, corsHeaders, status = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: "sanitized",
    scope,
    message: error?.message ?? String(error),
  }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
`
    )

    await Deno.writeTextFile(
      emailConfigStubPath,
      `
export async function getEmailSenderConfig() {
  return {
    default_from: globalThis.__defaultFrom ?? "Marque <noreply@example.test>",
  };
}
`
    )

    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify(
        {
          imports: {
            'https://deno.land/std@0.190.0/http/server.ts': fileUrl(serveStubPath),
            '@supabase/supabase-js': fileUrl(supabaseStubPath),
            'npm:resend@2.0.0': fileUrl(resendStubPath),
            [SHARED_ERROR_SANITIZER_URL]: fileUrl(errorSanitizerStubPath),
            [SHARED_EMAIL_CONFIG_URL]: fileUrl(emailConfigStubPath),
          },
        },
        null,
        2
      )
    )

    await Deno.writeTextFile(
      runnerPath,
      `
const emit = (value) => console.log("__RESULT__" + JSON.stringify(value));

globalThis.fetch = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

await import(${JSON.stringify(MODULE_INDEX_URL)});

if (typeof globalThis.__sendTestEmailHandler !== "function") {
  throw new Error("handler was not captured by serve stub");
}

${scenarioSource}
`
    )

    const command = new Deno.Command(Deno.execPath(), {
      args: ['run', '--allow-all', '--no-check', `--import-map=${importMapPath}`, runnerPath],
      cwd: MODULE_DIR,
      env: {
        RESEND_API_KEY: 'test-resend-key',
        SUPABASE_URL: 'https://supabase.example.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      },
      stdout: 'piped',
      stderr: 'piped',
    })

    const output = await command.output()
    const stdout = new TextDecoder().decode(output.stdout)
    const stderr = new TextDecoder().decode(output.stderr)

    assertEquals(output.code, 0, stderr)

    const resultLine = stdout.split(/\r?\n/).find((line) => line.startsWith('__RESULT__'))

    assertExists(resultLine, `No scenario result found. stdout=${stdout} stderr=${stderr}`)

    return JSON.parse(resultLine.slice('__RESULT__'.length))
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }

    await Deno.remove(tempDir, { recursive: true }).catch(() => {})
  }
}

testWithRunPermission('module loads and CORS preflight returns configured headers', async () => {
  const result = await runIsolatedScenario(`
const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", { method: "OPTIONS" }),
);

emit({
  status: response.status,
  body: await response.text(),
  origin: response.headers.get("access-control-allow-origin"),
  allowHeaders: response.headers.get("access-control-allow-headers"),
  resendApiKey: globalThis.__resendApiKey,
});
`)

  assertEquals(result.status, 200)
  assertEquals(result.body, '')
  assertEquals(result.origin, 'https://gestion-marque-ia.apercu.example.org')
  assertEquals(result.allowHeaders, 'authorization, x-client-info, apikey, content-type')
  assertEquals(result.resendApiKey, 'test-resend-key')
})

testWithRunPermission('handler rejects requests without Bearer authorization header', async () => {
  const result = await runIsolatedScenario(`
const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipient: "recipient@example.test" }),
  }),
);

emit({
  status: response.status,
  contentType: response.headers.get("content-type"),
  body: await response.json(),
  supabaseWasCreated: Boolean(globalThis.__supabaseConfig),
});
`)

  assertEquals(result.status, 401)
  assertEquals(result.contentType, 'application/json')
  assertEquals(result.body, {
    success: false,
    error: 'Unauthorized - Missing or invalid authorization header',
  })
  assertEquals(result.supabaseWasCreated, false)
})

testWithRunPermission('handler rejects invalid JWT tokens before admin role check', async () => {
  const result = await runIsolatedScenario(`
globalThis.__userError = true;

const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: {
      "authorization": "Bearer invalid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient: "recipient@example.test" }),
  }),
);

emit({
  status: response.status,
  body: await response.json(),
  jwt: globalThis.__jwt,
  supabaseConfig: globalThis.__supabaseConfig,
  rpcWasCalled: Boolean(globalThis.__rpcCall),
});
`)

  assertEquals(result.status, 401)
  assertEquals(result.body, {
    success: false,
    error: 'Unauthorized - Invalid token',
  })
  assertEquals(result.jwt, 'invalid-token')
  assertEquals(result.supabaseConfig, {
    url: 'https://supabase.example.test',
    key: 'test-service-role-key',
  })
  assertEquals(result.rpcWasCalled, false)
})

testWithRunPermission(
  'handler rejects authenticated users without strict admin 2FA role',
  async () => {
    const result = await runIsolatedScenario(`
globalThis.__userId = "admin-candidate-42";
globalThis.__isStrictAdmin = false;

const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: {
      "authorization": "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient: "recipient@example.test" }),
  }),
);

emit({
  status: response.status,
  body: await response.json(),
  rpcCall: globalThis.__rpcCall,
  emailWasSent: Boolean(globalThis.__lastEmailPayload),
});
`)

    assertEquals(result.status, 403)
    assertEquals(result.body, {
      success: false,
      error: 'Unauthorized - Admin access with 2FA required',
    })
    assertEquals(result.rpcCall, {
      name: 'has_admin_role_strict',
      args: { _user_id: 'admin-candidate-42' },
    })
    assertEquals(result.emailWasSent, false)
  }
)

testWithRunPermission('handler sends requested test email for strict admin user', async () => {
  const result = await runIsolatedScenario(`
globalThis.__userId = "strict-admin-1";
globalThis.__messageId = "email_msg_789";
globalThis.__defaultFrom = "Marque Test <sender@example.test>";

const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: {
      "authorization": "Bearer valid-admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipient: "doctor@example.test",
      subject: "Sujet de test personnalisé",
      content: "<p>Contenu personnalisé</p>",
    }),
  }),
);

emit({
  status: response.status,
  body: await response.json(),
  jwt: globalThis.__jwt,
  rpcCall: globalThis.__rpcCall,
  emailPayload: globalThis.__lastEmailPayload,
});
`)

  assertEquals(result.status, 200)
  assertEquals(result.body, {
    success: true,
    messageId: 'email_msg_789',
    message: 'Email de test envoyé avec succès',
  })
  assertEquals(result.jwt, 'valid-admin-token')
  assertEquals(result.rpcCall, {
    name: 'has_admin_role_strict',
    args: { _user_id: 'strict-admin-1' },
  })
  assertEquals(result.emailPayload, {
    from: 'Marque Test <sender@example.test>',
    to: ['doctor@example.test'],
    subject: 'Sujet de test personnalisé',
    html: '<p>Contenu personnalisé</p>',
  })
})

testWithRunPermission(
  'handler applies default email subject and HTML content when omitted',
  async () => {
    const result = await runIsolatedScenario(`
const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: {
      "authorization": "Bearer valid-admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient: "recipient@example.test" }),
  }),
);

emit({
  status: response.status,
  body: await response.json(),
  emailPayload: globalThis.__lastEmailPayload,
  htmlContainsTitle: globalThis.__lastEmailPayload.html.includes("Test de configuration email"),
  htmlContainsSuccessText: globalThis.__lastEmailPayload.html.includes("fonctionne correctement"),
  htmlContainsMarque: globalThis.__lastEmailPayload.html.includes("Marque"),
});
`)

    assertEquals(result.status, 200)
    assertEquals(result.body.success, true)
    assertEquals(result.body.messageId, 'msg_test_123')
    assertEquals(result.emailPayload.from, 'Marque <noreply@example.test>')
    assertEquals(result.emailPayload.to, ['recipient@example.test'])
    assertEquals(result.emailPayload.subject, 'Test de configuration email - Marque')
    assertEquals(result.htmlContainsTitle, true)
    assertEquals(result.htmlContainsSuccessText, true)
    assertEquals(result.htmlContainsMarque, true)
  }
)

testWithRunPermission(
  'handler returns sanitized error response when email provider fails',
  async () => {
    const result = await runIsolatedScenario(`
globalThis.__resendError = "provider unavailable";

const response = await globalThis.__sendTestEmailHandler(
  new Request("http://localhost", {
    method: "POST",
    headers: {
      "authorization": "Bearer valid-admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient: "recipient@example.test" }),
  }),
);

emit({
  status: response.status,
  contentType: response.headers.get("content-type"),
  origin: response.headers.get("access-control-allow-origin"),
  body: await response.json(),
  emailPayload: globalThis.__lastEmailPayload,
});
`)

    assertEquals(result.status, 500)
    assertEquals(result.contentType, 'application/json')
    assertEquals(result.origin, 'https://gestion-marque-ia.apercu.example.org')
    assertEquals(result.body, {
      success: false,
      error: 'sanitized',
      scope: 'send-test-email',
      message: 'provider unavailable',
    })
    assertEquals(result.emailPayload.to, ['recipient@example.test'])
  }
)
