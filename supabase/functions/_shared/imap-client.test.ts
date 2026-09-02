import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SharedImapClient, formatIMAPDate } from "./imap-client.ts";

Deno.test("formatIMAPDate formats dates for IMAP SEARCH SINCE criterion", () => {
  assertEquals(formatIMAPDate(new Date(2024, 0, 1)), "1-Jan-2024");
  assertEquals(formatIMAPDate(new Date(2024, 1, 29)), "29-Feb-2024");
  assertEquals(formatIMAPDate(new Date(2023, 11, 31)), "31-Dec-2023");
});

Deno.test("formatIMAPDate does not zero-pad single digit days", () => {
  assertEquals(formatIMAPDate(new Date(2025, 6, 4)), "4-Jul-2025");
});

Deno.test("formatIMAPDate propagates Date access errors", () => {
  const brokenDate = {
    getDate() {
      throw new Error("invalid date access");
    },
    getMonth() {
      return 0;
    },
    getFullYear() {
      return 2024;
    },
  } as unknown as Date;

  assertThrows(
    () => formatIMAPDate(brokenDate),
    Error,
    "invalid date access",
  );
});

Deno.test("SharedImapClient.connect stores host and port without opening a network connection", async () => {
  const imap = new SharedImapClient() as unknown as {
    connect: (hostname: string, port: number) => Promise<void>;
    _host: string;
    _port: number;
    client: unknown;
  };

  await imap.connect("imap.example.test", 993);

  assertEquals(imap._host, "imap.example.test");
  assertEquals(imap._port, 993);
  assertEquals(imap.client, null);
});

Deno.test("SharedImapClient.selectMailbox returns raw response placeholder and UIDNEXT", async () => {
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    selectMailbox: (mailbox: string) => Promise<{ raw: string; uidNext: number }>;
  };

  imap.client = {
    async selectMailbox(mailbox: string) {
      assertEquals(mailbox, "INBOX");
      return { uidNext: 4242 };
    },
  };

  const selected = await imap.selectMailbox("INBOX");

  assertEquals(selected, { raw: "", uidNext: 4242 });
});

Deno.test("SharedImapClient.selectMailbox defaults UIDNEXT to 1 when missing", async () => {
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    selectMailbox: (mailbox: string) => Promise<{ raw: string; uidNext: number }>;
  };

  imap.client = {
    async selectMailbox(mailbox: string) {
      assertEquals(mailbox, "Archive");
      return {};
    },
  };

  const selected = await imap.selectMailbox("Archive");

  assertEquals(selected, { raw: "", uidNext: 1 });
});

Deno.test("SharedImapClient.listMailboxes maps deno-imap mailbox objects to mailbox names", async () => {
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    listMailboxes: () => Promise<string[]>;
  };

  imap.client = {
    async listMailboxes() {
      return [
        { name: "INBOX" },
        { name: "INBOX.Sent" },
        { name: "Archive/2024" },
      ];
    },
  };

  const names = await imap.listMailboxes();

  assertEquals(names, ["INBOX", "INBOX.Sent", "Archive/2024"]);
});

Deno.test("SharedImapClient.searchUids executes UID SEARCH and parses returned UIDs", async () => {
  const commands: string[] = [];
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    searchUids: (criteria: string) => Promise<string[]>;
  };

  imap.client = {
    async executeCommand(command: string) {
      commands.push(command);
      return ["* SEARCH 10 20 30", "A001 OK SEARCH completed"];
    },
  };

  const uids = await imap.searchUids("SINCE 1-Jan-2024");

  assertEquals(commands, ["UID SEARCH SINCE 1-Jan-2024"]);
  assertEquals(uids, ["10", "20", "30"]);
});

Deno.test("SharedImapClient.searchUids returns an empty array when SEARCH response has no UIDs", async () => {
  const commands: string[] = [];
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    searchUids: (criteria: string) => Promise<string[]>;
  };

  imap.client = {
    async executeCommand(command: string) {
      commands.push(command);
      return ["* SEARCH", "A002 OK SEARCH completed"];
    },
  };

  const uids = await imap.searchUids("UNSEEN");

  assertEquals(commands, ["UID SEARCH UNSEEN"]);
  assertEquals(uids, []);
});

Deno.test("SharedImapClient.fetchSize executes UID FETCH RFC822.SIZE and parses the message size", async () => {
  const commands: string[] = [];
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    fetchSize: (uid: string) => Promise<number>;
  };

  imap.client = {
    async executeCommand(command: string) {
      commands.push(command);
      return ["* 1 FETCH (UID 123 RFC822.SIZE 98765)", "A003 OK FETCH completed"];
    },
  };

  const size = await imap.fetchSize("123");

  assertEquals(commands, ["UID FETCH 123 (RFC822.SIZE)"]);
  assertEquals(size, 98765);
});

Deno.test("SharedImapClient.fetchSize returns 0 when RFC822.SIZE is absent", async () => {
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    fetchSize: (uid: string) => Promise<number>;
  };

  imap.client = {
    async executeCommand() {
      return ["A004 OK FETCH completed"];
    },
  };

  const size = await imap.fetchSize("999");

  assertEquals(size, 0);
});

Deno.test("SharedImapClient fetch helpers build the expected UID FETCH commands", async () => {
  const commands: string[] = [];
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    fetchHeadersAndFlags: (uid: string) => Promise<string>;
    fetchHeaders: (uid: string) => Promise<string>;
    fetchBodyPartial: (uid: string, maxBytes?: number) => Promise<string>;
  };

  imap.client = {
    async executeCommand(command: string) {
      commands.push(command);
      return [`response for ${command}`, "A005 OK FETCH completed"];
    },
  };

  const headersAndFlags = await imap.fetchHeadersAndFlags("42");
  const headers = await imap.fetchHeaders("43");
  const defaultBody = await imap.fetchBodyPartial("44");
  const customBody = await imap.fetchBodyPartial("45", 2048);

  assertEquals(commands, [
    "UID FETCH 42 (FLAGS BODY.PEEK[HEADER])",
    "UID FETCH 43 (BODY.PEEK[HEADER])",
    "UID FETCH 44 (BODY.PEEK[TEXT]<0.51200>)",
    "UID FETCH 45 (BODY.PEEK[TEXT]<0.2048>)",
  ]);

  assertEquals(headersAndFlags, "response for UID FETCH 42 (FLAGS BODY.PEEK[HEADER])\r\nA005 OK FETCH completed");
  assertEquals(headers, "response for UID FETCH 43 (BODY.PEEK[HEADER])\r\nA005 OK FETCH completed");
  assertEquals(defaultBody, "response for UID FETCH 44 (BODY.PEEK[TEXT]<0.51200>)\r\nA005 OK FETCH completed");
  assertEquals(customBody, "response for UID FETCH 45 (BODY.PEEK[TEXT]<0.2048>)\r\nA005 OK FETCH completed");
});

Deno.test("SharedImapClient.logout disconnects and clears the internal client", async () => {
  let disconnected = false;
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    logout: () => Promise<void>;
  };

  imap.client = {
    async disconnect() {
      disconnected = true;
    },
  };

  await imap.logout();

  assertEquals(disconnected, true);
  assertEquals(imap.client, null);
});

Deno.test("SharedImapClient.logout ignores disconnect errors and still clears the internal client", async () => {
  const imap = new SharedImapClient() as unknown as {
    client: unknown;
    logout: () => Promise<void>;
  };

  imap.client = {
    async disconnect() {
      throw new Error("already closed");
    },
  };

  await imap.logout();

  assertEquals(imap.client, null);
});

Deno.test("SharedImapClient methods reject when used before a client is available", async () => {
  const imap = new SharedImapClient();

  assertExists(imap);

  await assertRejects(
    () => imap.fetchSize("1"),
    TypeError,
  );
});