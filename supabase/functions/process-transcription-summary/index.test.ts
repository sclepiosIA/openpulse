import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads without opening a real HTTP listener", async () => {
  const restoreCallbacks: Array<() => void> = [];

  const replaceDenoProperty = (key: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(Deno, key);
    try {
      Object.defineProperty(Deno, key, {
        value,
        writable: true,
        configurable: true,
      });
    } catch {
      (Deno as any)[key] = value;
    }

    restoreCallbacks.push(() => {
      if (descriptor) {
        try {
          Object.defineProperty(Deno, key, descriptor);
        } catch {
          (Deno as any)[key] = descriptor.value;
        }
      } else {
        try {
          delete (Deno as any)[key];
        } catch {
          (Deno as any)[key] = undefined;
        }
      }
    });
  };

  const never = () => new Promise<never>(() => {});

  const fakeListener = {
    rid: 0,
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 0,
    },
    accept: never,
    close: () => {},
    ref: () => {},
    unref: () => {},
    [Symbol.asyncIterator]() {
      return {
        next: never,
      };
    },
  };

  const fakeHttpServer = {
    finished: Promise.resolve(),
    shutdown: () => Promise.resolve(),
    ref: () => {},
    unref: () => {},
  };

  replaceDenoProperty("listen", () => fakeListener);
  replaceDenoProperty("listenTls", () => fakeListener);
  replaceDenoProperty("serve", () => fakeHttpServer);

  try {
    const module = await import("./index.ts");
    assertExists(module);
    assertEquals(typeof module, "object");
  } finally {
    for (const restore of restoreCallbacks.reverse()) {
      restore();
    }
  }
});