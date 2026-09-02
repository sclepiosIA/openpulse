import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type GenerateICS = (booking: Record<string, any>, startDate: Date, endDate: Date) => string;

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function extractGenerateICSFromSource(source: string): GenerateICS {
  const start = source.indexOf("function generateICS(");
  if (start === -1) {
    throw new Error("generateICS function not found");
  }

  let jsSource = source.slice(start);
  jsSource = jsSource.replace(
    /function generateICS\(booking:\s*any,\s*startDate:\s*Date,\s*endDate:\s*Date\):\s*string/,
    "function generateICS(booking, startDate, endDate)",
  );
  jsSource = jsSource.replace(/\((\w+):\s*Date\)/g, "($1)");

  const factory = new Function(`${jsSource}\nreturn generateICS;`);
  return factory() as GenerateICS;
}

function installPendingDenoListen() {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const calls: unknown[] = [];
  let closed = false;

  const fakeListener = {
    rid: -1,
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    close() {
      closed = true;
    },
    ref() {},
    unref() {},
    accept: () => new Promise<never>(() => {}),
    [Symbol.asyncIterator]() {
      return {
        next: () => closed
          ? Promise.resolve({ value: undefined, done: true })
          : new Promise<IteratorResult<unknown>>(() => {}),
      };
    },
  };

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: (options: unknown) => {
      calls.push(options);
      return fakeListener;
    },
  });

  return {
    calls,
    fakeListener,
    restore() {
      fakeListener.close();
      if (originalDescriptor) {
        Object.defineProperty(Deno, "listen", originalDescriptor);
      } else {
        Reflect.deleteProperty(Deno, "listen");
      }
    },
  };
}

Deno.test("module loads without opening a real HTTP listener", async () => {
  const listenStub = installPendingDenoListen();

  try {
    const mod = await import(`./index.ts?module-load-test=${crypto.randomUUID()}`);
    assertExists(mod);
    assertEquals(listenStub.calls.length, 1);

    const listenOptions = listenStub.calls[0] as { port?: number; hostname?: string };
    assertEquals(listenOptions.port, 8000);
  } finally {
    listenStub.restore();
  }
});

Deno.test("generateICS builds a complete calendar invitation with booking details", async () => {
  const generateICS = extractGenerateICSFromSource(await readIndexSource());

  const ics = generateICS(
    {
      id: "booking-123",
      guest_email: "patient@example.test",
      location: "Cabinet 2",
      video_conference_url: "https://meet.example.test/abc",
      booking_type: {
        name: "Consultation IA",
        description: "Préparation du dossier",
      },
      host: {
        first_name: "Alice",
        email: "alice@example.test",
      },
    },
    new Date("2025-03-10T09:15:00.000Z"),
    new Date("2025-03-10T09:45:00.000Z"),
  );

  assertExists(ics);
  assertEquals(ics.split("\n")[0], "BEGIN:VCALENDAR");
  assertEquals(ics.includes("VERSION:2.0"), true);
  assertEquals(ics.includes("PRODID:-//OpenPulse//Booking//FR"), true);
  assertEquals(ics.includes("METHOD:REQUEST"), true);
  assertEquals(ics.includes("UID:booking-123@exploitant.example.org"), true);
  assertEquals(ics.includes("DTSTART:20250310T091500Z"), true);
  assertEquals(ics.includes("DTEND:20250310T094500Z"), true);
  assertEquals(ics.includes("SUMMARY:Consultation IA avec Alice"), true);
  assertEquals(
    ics.includes("DESCRIPTION:Préparation du dossier\\n\\nLien visio: https://meet.example.test/abc"),
    true,
  );
  assertEquals(ics.includes("LOCATION:Cabinet 2"), true);
  assertEquals(ics.includes("ORGANIZER;CN=Alice:mailto:alice@example.test"), true);
  assertEquals(ics.includes("ATTENDEE;RSVP=TRUE;PARTSTAT=ACCEPTED:mailto:patient@example.test"), true);
  assertEquals(ics.includes("STATUS:CONFIRMED"), true);
  assertEquals(ics.includes("SEQUENCE:0"), true);
  assertEquals(ics.endsWith("END:VCALENDAR"), true);
});

Deno.test("generateICS uses documented defaults when optional booking relations are missing", async () => {
  const generateICS = extractGenerateICSFromSource(await readIndexSource());

  const ics = generateICS(
    {
      id: "fallback-booking",
      guest_email: "guest@example.test",
    },
    new Date("2025-12-24T14:00:00.000Z"),
    new Date("2025-12-24T14:30:00.000Z"),
  );

  assertEquals(ics.includes("UID:fallback-booking@exploitant.example.org"), true);
  assertEquals(ics.includes("DTSTART:20251224T140000Z"), true);
  assertEquals(ics.includes("DTEND:20251224T143000Z"), true);
  assertEquals(ics.includes("SUMMARY:Rendez-vous avec OpenPulse"), true);
  assertEquals(ics.includes("DESCRIPTION:"), true);
  assertEquals(ics.includes("LOCATION:À confirmer"), true);
  assertEquals(ics.includes("ORGANIZER;CN=OpenPulse:mailto:noreply@exploitant.example.org"), true);
  assertEquals(ics.includes("ATTENDEE;RSVP=TRUE;PARTSTAT=ACCEPTED:mailto:guest@example.test"), true);
});

Deno.test("generateICS uses video conference URL as location when physical location is absent", async () => {
  const generateICS = extractGenerateICSFromSource(await readIndexSource());

  const ics = generateICS(
    {
      id: "video-only-booking",
      guest_email: "remote-guest@example.test",
      video_conference_url: "https://visio.example.test/room-42",
      booking_type: {
        name: "Téléconsultation",
        description: "Échange à distance",
      },
      host: {
        first_name: "Dr Martin",
        email: "martin@example.test",
      },
    },
    new Date("2025-06-01T16:05:00.000Z"),
    new Date("2025-06-01T16:50:00.000Z"),
  );

  assertEquals(ics.includes("SUMMARY:Téléconsultation avec Dr Martin"), true);
  assertEquals(ics.includes("LOCATION:https://visio.example.test/room-42"), true);
  assertEquals(
    ics.includes("DESCRIPTION:Échange à distance\\n\\nLien visio: https://visio.example.test/room-42"),
    true,
  );
});

Deno.test("generateICS throws for invalid start dates", async () => {
  const generateICS = extractGenerateICSFromSource(await readIndexSource());

  assertThrows(
    () =>
      generateICS(
        {
          id: "invalid-date-booking",
          guest_email: "guest@example.test",
        },
        new Date("not-a-date"),
        new Date("2025-01-01T10:30:00.000Z"),
      ),
    RangeError,
  );
});

Deno.test("generateICS extractor rejects when helper is absent from source", async () => {
  await assertRejects(
    async () => {
      extractGenerateICSFromSource("const corsHeaders = {};");
    },
    Error,
    "generateICS function not found",
  );
});