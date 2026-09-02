import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCopyFile,
  executeCreateFolder,
  executeDeleteFile,
  executeGetFileUrl,
  executeGetStorageStats,
  executeListFiles,
  executeMoveFile,
  executeSearchDocuments,
} from "./file-management-tools.ts";

type StorageBehavior = {
  listData?: unknown[];
  listError?: unknown;
  listThrows?: Error;
  signedUrl?: string;
  signedUrlError?: unknown;
  moveError?: unknown;
  copyError?: unknown;
  removeError?: unknown;
  uploadError?: unknown;
};

function createStorageContext(config: Record<string, StorageBehavior> = {}) {
  const calls: unknown[] = [];

  const supabase = {
    storage: {
      from(bucket: string) {
        calls.push({ method: "from", bucket });
        const behavior = config[bucket] ?? config.default ?? {};

        return {
          async list(folder: string, options: unknown) {
            calls.push({ method: "list", bucket, folder, options });
            if (behavior.listThrows) {
              throw behavior.listThrows;
            }
            return {
              data: behavior.listData ?? [],
              error: behavior.listError ?? null,
            };
          },

          async createSignedUrl(path: string, expiresIn: number) {
            calls.push({ method: "createSignedUrl", bucket, path, expiresIn });
            return {
              data: { signedUrl: behavior.signedUrl ?? `https://signed.example/${path}` },
              error: behavior.signedUrlError ?? null,
            };
          },

          async move(fromPath: string, toPath: string) {
            calls.push({ method: "move", bucket, fromPath, toPath });
            return { error: behavior.moveError ?? null };
          },

          async copy(fromPath: string, toPath: string) {
            calls.push({ method: "copy", bucket, fromPath, toPath });
            return { error: behavior.copyError ?? null };
          },

          async remove(paths: string[]) {
            calls.push({ method: "remove", bucket, paths });
            return { error: behavior.removeError ?? null };
          },

          async upload(path: string, body: Blob, options: unknown) {
            calls.push({ method: "upload", bucket, path, body, options });
            return { data: { path }, error: behavior.uploadError ?? null };
          },
        };
      },
    },
  };

  return {
    ctx: { supabase, userId: "user-123" },
    calls,
  };
}

function createDatabaseContext(response: { data?: unknown[] | null; error?: unknown }) {
  const calls: unknown[] = [];

  const query: Record<string, unknown> = {
    select(columns: string) {
      calls.push({ method: "select", columns });
      return query;
    },

    ilike(column: string, value: string) {
      calls.push({ method: "ilike", column, value });
      return query;
    },

    order(column: string, options: unknown) {
      calls.push({ method: "order", column, options });
      return query;
    },

    limit(value: number) {
      calls.push({ method: "limit", value });
      return query;
    },

    eq(column: string, value: string) {
      calls.push({ method: "eq", column, value });
      return query;
    },

    then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
      calls.push({ method: "then" });
      return Promise.resolve({
        data: response.data ?? null,
        error: response.error ?? null,
      }).then(resolve, reject);
    },
  };

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", table });
      return query;
    },
  };

  return {
    ctx: { supabase, userId: "user-123" },
    calls,
  };
}

Deno.test("exports file-management tool functions", () => {
  assertExists(executeListFiles);
  assertExists(executeGetFileUrl);
  assertExists(executeMoveFile);
  assertExists(executeCopyFile);
  assertExists(executeDeleteFile);
  assertExists(executeSearchDocuments);
  assertExists(executeGetStorageStats);
  assertExists(executeCreateFolder);
  assertThrows(() => {
    throw new Error("local assertion sanity check");
  }, Error, "local assertion sanity check");
});

Deno.test("executeListFiles lists files with defaults, folder path mapping and pdf filtering", async () => {
  const { ctx, calls } = createStorageContext({
    documents: {
      listData: [
        {
          name: "report.pdf",
          id: "1",
          created_at: "2024-01-10T10:00:00Z",
          metadata: { size: 1200, mimetype: "application/pdf" },
        },
        {
          name: "photo.PNG",
          id: "2",
          created_at: "2024-01-11T10:00:00Z",
          metadata: { size: 2400, mimetype: "image/png" },
        },
        {
          name: "summary.PDF",
          id: "3",
          created_at: "2024-01-12T10:00:00Z",
          metadata: { size: 900, mimetype: "application/pdf" },
        },
      ],
    },
  });

  const result = await executeListFiles(ctx as never, {
    folder: "finance",
    search: "rep",
    file_type: "pdf",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.bucket, "documents");
  assertEquals(result.data.folder, "finance");
  assertEquals(result.data.count, 2);
  assertEquals(result.data.files, [
    {
      name: "report.pdf",
      size: 1200,
      created_at: "2024-01-10T10:00:00Z",
      mime_type: "application/pdf",
      path: "finance/report.pdf",
    },
    {
      name: "summary.PDF",
      size: 900,
      created_at: "2024-01-12T10:00:00Z",
      mime_type: "application/pdf",
      path: "finance/summary.PDF",
    },
  ]);
  assertEquals(calls[0], { method: "from", bucket: "documents" });
  assertEquals(calls[1], {
    method: "list",
    bucket: "documents",
    folder: "finance",
    options: { limit: 50, search: "rep" },
  });
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeListFiles returns a business error when Supabase storage returns an error", async () => {
  const { ctx } = createStorageContext({
    documents: {
      listError: new Error("storage policy denied"),
    },
  });

  const result = await executeListFiles(ctx as never, { bucket: "documents" });

  assertEquals(result.success, false);
  assertEquals(result.error, "storage policy denied");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeGetFileUrl creates signed URL with default expiration", async () => {
  const { ctx, calls } = createStorageContext({
    documents: {
      signedUrl: "https://signed.example/documents/contract.pdf?token=abc",
    },
  });

  const result = await executeGetFileUrl(ctx as never, {
    bucket: "documents",
    path: "contracts/contract.pdf",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    url: "https://signed.example/documents/contract.pdf?token=abc",
    expires_in_seconds: 3600,
    path: "contracts/contract.pdf",
    bucket: "documents",
  });
  assertEquals(calls[1], {
    method: "createSignedUrl",
    bucket: "documents",
    path: "contracts/contract.pdf",
    expiresIn: 3600,
  });
});

Deno.test("executeGetFileUrl uses custom expiration and reports Supabase errors", async () => {
  const successContext = createStorageContext({
    documents: {
      signedUrl: "https://signed.example/custom",
    },
  });

  const success = await executeGetFileUrl(successContext.ctx as never, {
    bucket: "documents",
    path: "a.txt",
    expires_in: 120,
  });

  assertEquals(success.success, true);
  assertEquals(success.data.expires_in_seconds, 120);
  assertEquals(successContext.calls[1], {
    method: "createSignedUrl",
    bucket: "documents",
    path: "a.txt",
    expiresIn: 120,
  });

  const errorContext = createStorageContext({
    documents: {
      signedUrlError: new Error("cannot sign file"),
    },
  });

  const failure = await executeGetFileUrl(errorContext.ctx as never, {
    bucket: "documents",
    path: "missing.txt",
  });

  assertEquals(failure.success, false);
  assertEquals(failure.error, "cannot sign file");
});

Deno.test("executeMoveFile and executeCopyFile call storage operations and return localized messages", async () => {
  const { ctx, calls } = createStorageContext();

  const moveResult = await executeMoveFile(ctx as never, {
    bucket: "documents",
    from_path: "incoming/a.pdf",
    to_path: "archive/a.pdf",
  });

  const copyResult = await executeCopyFile(ctx as never, {
    bucket: "documents",
    from_path: "archive/a.pdf",
    to_path: "backup/a.pdf",
  });

  assertEquals(moveResult.success, true);
  assertEquals(moveResult.data, {
    message: "Fichier déplacé vers archive/a.pdf",
    from: "incoming/a.pdf",
    to: "archive/a.pdf",
  });
  assertEquals(copyResult.success, true);
  assertEquals(copyResult.data, {
    message: "Fichier copié vers backup/a.pdf",
    from: "archive/a.pdf",
    to: "backup/a.pdf",
  });
  assertEquals(calls[1], {
    method: "move",
    bucket: "documents",
    fromPath: "incoming/a.pdf",
    toPath: "archive/a.pdf",
  });
  assertEquals(calls[3], {
    method: "copy",
    bucket: "documents",
    fromPath: "archive/a.pdf",
    toPath: "backup/a.pdf",
  });
});

Deno.test("executeDeleteFile validates path count before calling storage", async () => {
  const { ctx, calls } = createStorageContext();

  const emptyResult = await executeDeleteFile(ctx as never, {
    bucket: "documents",
    paths: [],
  });

  const tooManyResult = await executeDeleteFile(ctx as never, {
    bucket: "documents",
    paths: Array.from({ length: 11 }, (_, index) => `file-${index}.txt`),
  });

  assertEquals(emptyResult.success, false);
  assertEquals(emptyResult.error, "Aucun fichier spécifié");
  assertEquals(tooManyResult.success, false);
  assertEquals(tooManyResult.error, "Maximum 10 fichiers à supprimer à la fois");
  assertEquals(calls.length, 0);
});

Deno.test("executeDeleteFile removes up to ten files and returns deleted paths", async () => {
  const { ctx, calls } = createStorageContext();

  const result = await executeDeleteFile(ctx as never, {
    bucket: "documents",
    paths: ["a.txt", "folder/b.txt"],
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "2 fichier(s) supprimé(s)",
    deleted: ["a.txt", "folder/b.txt"],
  });
  assertEquals(calls[0], { method: "from", bucket: "documents" });
  assertEquals(calls[1], {
    method: "remove",
    bucket: "documents",
    paths: ["a.txt", "folder/b.txt"],
  });
});

Deno.test("executeSearchDocuments builds query with filters, ordering and limit", async () => {
  const documents = [
    {
      id: "doc-1",
      nom: "Budget 2024",
      type: "pdf",
      description: "Budget annuel",
      storage_path: "budget-2024.pdf",
      created_at: "2024-02-01T00:00:00Z",
      etablissement: { nom: "Lycée Exemple" },
    },
  ];

  const { ctx, calls } = createDatabaseContext({ data: documents });

  const result = await executeSearchDocuments(ctx as never, {
    query: "Budget",
    etablissement_id: "etab-1",
    document_type: "pdf",
    limit: 5,
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    documents,
    count: 1,
    query: "Budget",
  });
  assertEquals(calls[0], { method: "from", table: "documents" });
  assertEquals(calls[1], {
    method: "select",
    columns: "id, nom, type, description, storage_path, created_at, etablissement:etablissements(nom)",
  });
  assertEquals(calls[2], { method: "ilike", column: "nom", value: "%Budget%" });
  assertEquals(calls[3], { method: "order", column: "created_at", options: { ascending: false } });
  assertEquals(calls[4], { method: "limit", value: 5 });
  assertEquals(calls[5], { method: "eq", column: "etablissement_id", value: "etab-1" });
  assertEquals(calls[6], { method: "eq", column: "type", value: "pdf" });
});

Deno.test("executeSearchDocuments uses default limit and reports database error", async () => {
  const { ctx, calls } = createDatabaseContext({
    error: new Error("database unavailable"),
  });

  const result = await executeSearchDocuments(ctx as never, {
    query: "contrat",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertEquals(calls[4], { method: "limit", value: 20 });
});

Deno.test("executeGetStorageStats aggregates default buckets and isolates bucket list failures", async () => {
  const { ctx } = createStorageContext({
    documents: {
      listData: [
        { id: "file-1", name: "contract.pdf" },
        { id: "folder-1/", name: "archives" },
        { id: "file-2", name: "invoice.pdf" },
      ],
    },
    avatars: {
      listThrows: new Error("bucket unavailable"),
    },
    formations: {
      listData: [
        { id: "folder-2/", name: "videos" },
        { id: "file-3", name: "intro.mp4" },
      ],
    },
    "rh-documents": {
      listData: [
        { id: "file-4", name: "policy.pdf" },
        { name: "without-id.txt" },
      ],
    },
  });

  const result = await executeGetStorageStats(ctx as never, {});

  assertEquals(result.success, true);
  assertEquals(result.data.buckets, {
    documents: { files: 2, folders: ["archives"] },
    avatars: { files: 0, folders: [] },
    formations: { files: 1, folders: ["videos"] },
    "rh-documents": { files: 2, folders: [] },
  });
  assertEquals(result.data.total_files, 5);
});

Deno.test("executeGetStorageStats supports a single requested bucket", async () => {
  const { ctx, calls } = createStorageContext({
    documents: {
      listData: [
        { id: "folder/", name: "folder" },
        { id: "file", name: "file.txt" },
      ],
    },
  });

  const result = await executeGetStorageStats(ctx as never, {
    bucket: "documents",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.buckets, {
    documents: { files: 1, folders: ["folder"] },
  });
  assertEquals(result.data.total_files, 1);
  assertEquals(calls.length, 2);
  assertEquals(calls[1], {
    method: "list",
    bucket: "documents",
    folder: "",
    options: { limit: 1000 },
  });
});

Deno.test("executeCreateFolder uploads .keep file with upsert enabled", async () => {
  const { ctx, calls } = createStorageContext();

  const result = await executeCreateFolder(ctx as never, {
    bucket: "documents",
    folder_path: "clients/2024",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: 'Dossier "clients/2024" créé',
    bucket: "documents",
    path: "clients/2024",
  });

  const uploadCall = calls[1] as {
    method: string;
    bucket: string;
    path: string;
    body: Blob;
    options: unknown;
  };

  assertEquals(uploadCall.method, "upload");
  assertEquals(uploadCall.bucket, "documents");
  assertEquals(uploadCall.path, "clients/2024/.keep");
  assertEquals(uploadCall.body instanceof Blob, true);
  assertEquals(uploadCall.body.type, "text/plain");
  assertEquals(uploadCall.body.size, 0);
  assertEquals(uploadCall.options, { upsert: true });
});

Deno.test("executeCreateFolder reports upload errors without throwing", async () => {
  const { ctx } = createStorageContext({
    documents: {
      uploadError: new Error("quota exceeded"),
    },
  });

  const result = await executeCreateFolder(ctx as never, {
    bucket: "documents",
    folder_path: "blocked",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "quota exceeded");
});

Deno.test("executeDeleteFile resolves instead of rejecting on storage errors", async () => {
  const { ctx } = createStorageContext({
    documents: {
      removeError: new Error("remove denied"),
    },
  });

  await assertRejects(
    () => Promise.reject(new Error("control rejection")),
    Error,
    "control rejection",
  );

  const result = await executeDeleteFile(ctx as never, {
    bucket: "documents",
    paths: ["protected.pdf"],
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "remove denied");
});