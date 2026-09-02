import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCalculateDate,
  executeConvertUnits,
  executeGetWeather,
} from "./utility-tools.ts";

const ctx = {
  supabase: {},
  userId: "user-test",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function withStubbedFetch<T>(
  stub: typeof fetch,
  fn: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withUtcTimezone<T>(fn: () => Promise<T>): Promise<T> {
  const previous = Deno.env.get("TZ");
  Deno.env.set("TZ", "UTC");
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      Deno.env.delete("TZ");
    } else {
      Deno.env.set("TZ", previous);
    }
  }
}

Deno.test("executeCalculateDate adds weeks and returns an ISO result", async () => {
  await withUtcTimezone(async () => {
    const result = await executeCalculateDate(ctx, {
      operation: "add",
      date: "2024-01-15T12:00:00.000Z",
      amount: 2,
      unit: "weeks",
    });

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals(result.data.original_date, "2024-01-15T12:00:00.000Z");
    assertEquals(result.data.result_date, "2024-01-29T12:00:00.000Z");
    assertEquals(result.data.operation, "add 2 weeks");
    assertEquals(typeof result.execution_time_ms, "number");
  });
});

Deno.test("executeCalculateDate subtracts hours", async () => {
  await withUtcTimezone(async () => {
    const result = await executeCalculateDate(ctx, {
      operation: "subtract",
      date: "2024-03-10T10:30:00.000Z",
      amount: 5,
      unit: "hours",
    });

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals(result.data.result_date, "2024-03-10T05:30:00.000Z");
    assertEquals(result.data.operation, "subtract 5 hours");
  });
});

Deno.test("executeCalculateDate calculates date differences in days, weeks, months and years", async () => {
  await withUtcTimezone(async () => {
    const result = await executeCalculateDate(ctx, {
      operation: "diff",
      date: "2024-01-01T00:00:00.000Z",
      date2: "2024-01-31T00:00:00.000Z",
    });

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals(result.data.date1, "2024-01-01T00:00:00.000Z");
    assertEquals(result.data.date2, "2024-01-31T00:00:00.000Z");
    assertEquals(result.data.difference.days, 30);
    assertEquals(result.data.difference.weeks, 4);
    assertEquals(result.data.difference.months, 1);
    assertEquals(result.data.difference.years, 0);
    assertEquals(result.data.difference.milliseconds, 2592000000);
    assertEquals(result.data.formatted, "30 jours après");
  });
});

Deno.test("executeCalculateDate formats a weekend date", async () => {
  await withUtcTimezone(async () => {
    const result = await executeCalculateDate(ctx, {
      operation: "format",
      date: "2024-06-15T12:30:00.000Z",
    });

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals(result.data.original, "2024-06-15T12:30:00.000Z");
    assertEquals(result.data.iso, "2024-06-15T12:30:00.000Z");
    assertEquals(result.data.timestamp, 1718454600000);
    assertEquals(result.data.day_of_week, "samedi");
    assertEquals(result.data.is_weekend, true);
  });
});

Deno.test("executeCalculateDate counts inclusive workdays", async () => {
  await withUtcTimezone(async () => {
    const result = await executeCalculateDate(ctx, {
      operation: "workdays",
      date: "2024-06-03T12:00:00.000Z",
      date2: "2024-06-09T12:00:00.000Z",
    });

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals(result.data.start_date, "2024-06-03T12:00:00.000Z");
    assertEquals(result.data.end_date, "2024-06-09T12:00:00.000Z");
    assertEquals(result.data.workdays, 5);
    assertEquals(result.data.calendar_days, 7);
  });
});

Deno.test("executeCalculateDate rejects invalid base dates", async () => {
  const result = await executeCalculateDate(ctx, {
    operation: "add",
    date: "not-a-date",
    amount: 1,
    unit: "days",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Date invalide: not-a-date");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeCalculateDate requires date2 for diff", async () => {
  const result = await executeCalculateDate(ctx, {
    operation: "diff",
    date: "2024-01-01T00:00:00.000Z",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "date2 requis pour calculer une différence");
});

Deno.test("executeCalculateDate rejects unknown operations", async () => {
  const result = await executeCalculateDate(ctx, {
    operation: "unknown",
    date: "2024-01-01T00:00:00.000Z",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Opération inconnue: unknown");
});

Deno.test("executeConvertUnits converts Fahrenheit to Celsius", async () => {
  const result = await executeConvertUnits(ctx, {
    value: 32,
    from_unit: "F",
    to_unit: "C",
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.original_value, 32);
  assertEquals(result.data.original_unit, "F");
  assertEquals(result.data.converted_value, 0);
  assertEquals(result.data.target_unit, "C");
  assertEquals(result.data.category, "temperature");
});

Deno.test("executeConvertUnits converts Celsius to Kelvin with degree symbol", async () => {
  const result = await executeConvertUnits(ctx, {
    value: 25,
    from_unit: "°C",
    to_unit: "K",
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.converted_value, 298.15);
  assertEquals(result.data.category, "temperature");
});

Deno.test("executeConvertUnits converts gigabytes to megabytes", async () => {
  const result = await executeConvertUnits(ctx, {
    value: 1.5,
    from_unit: "GB",
    to_unit: "MB",
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.original_value, 1.5);
  assertEquals(result.data.original_unit, "GB");
  assertEquals(result.data.converted_value, 1500);
  assertEquals(result.data.target_unit, "MB");
  assertEquals(result.data.conversion_factor, 1000);
});

Deno.test("executeConvertUnits reports unsupported lowercase length units according to current implementation", async () => {
  const result = await executeConvertUnits(ctx, {
    value: 2,
    from_unit: "km",
    to_unit: "m",
  });

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Unité source inconnue: km. Unités supportées: m, km, cm, mm, mi, ft, in, kg, g, mg, lb, oz, t, B, KB, MB, GB, TB",
  );
});

Deno.test("executeConvertUnits returns an error for unknown temperature target units", async () => {
  const result = await executeConvertUnits(ctx, {
    value: 20,
    from_unit: "C",
    to_unit: "m",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Unité de température inconnue: m");
});

Deno.test("executeGetWeather fetches geocoding and weather offline, clamps days to seven", async () => {
  const calls: Array<{ url: string; headers?: HeadersInit }> = [];

  await withStubbedFetch(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

      calls.push({ url, headers: init?.headers });

      if (url.startsWith("https://nominatim.openstreetmap.org/search")) {
        return jsonResponse([
          {
            lat: "43.7",
            lon: "7.26",
            display_name: "Nice, Alpes-Maritimes, France",
          },
        ]);
      }

      if (url.startsWith("https://api.open-meteo.com/v1/forecast")) {
        return jsonResponse({
          current_weather: {
            temperature: 21.4,
            windspeed: 12.8,
            weathercode: 1,
          },
          daily: {
            time: ["2024-06-01", "2024-06-02", "2024-06-03"],
            temperature_2m_max: [24.1, 25.2, 23.8],
            temperature_2m_min: [16.3, 17.1, 15.9],
            precipitation_sum: [0, 2.5, 10.2],
            weathercode: [0, 61, 95],
          },
        });
      }

      return jsonResponse({ unexpected: true }, 404);
    },
    async () => {
      const result = await executeGetWeather(ctx, {
        city: "Nice",
        country: "France",
        days: 10,
      });

      assertEquals(result.success, true);
      assertExists(result.data);
      assertEquals(calls.length, 2);

      const geoUrl = new URL(calls[0].url);
      assertEquals(geoUrl.origin, "https://nominatim.openstreetmap.org");
      assertEquals(geoUrl.searchParams.get("q"), "Nice, France");
      assertEquals(geoUrl.searchParams.get("format"), "json");
      assertEquals(geoUrl.searchParams.get("limit"), "1");
      assertEquals(
        (calls[0].headers as Record<string, string>)["User-Agent"],
        "Marque-IA-Jarvis/1.0",
      );

      const weatherUrl = new URL(calls[1].url);
      assertEquals(weatherUrl.origin, "https://api.open-meteo.com");
      assertEquals(weatherUrl.searchParams.get("latitude"), "43.7");
      assertEquals(weatherUrl.searchParams.get("longitude"), "7.26");
      assertEquals(weatherUrl.searchParams.get("forecast_days"), "7");

      assertEquals(result.data.location, "Nice, Alpes-Maritimes, France");
      assertEquals(result.data.coordinates, { lat: "43.7", lon: "7.26" });
      assertEquals(result.data.current, {
        temperature: 21.4,
        windspeed: 12.8,
        condition: "🌤️ Principalement dégagé",
      });
      assertEquals(result.data.forecast, [
        {
          date: "2024-06-01",
          temp_max: 24.1,
          temp_min: 16.3,
          precipitation: 0,
          condition: "☀️ Ciel dégagé",
        },
        {
          date: "2024-06-02",
          temp_max: 25.2,
          temp_min: 17.1,
          precipitation: 2.5,
          condition: "🌧️ Pluie légère",
        },
        {
          date: "2024-06-03",
          temp_max: 23.8,
          temp_min: 15.9,
          precipitation: 10.2,
          condition: "⛈️ Orage",
        },
      ]);
      assertEquals(result.data.units, {
        temperature: "°C",
        windspeed: "km/h",
        precipitation: "mm",
      });
      assertEquals(typeof result.execution_time_ms, "number");
    },
  );
});

Deno.test("executeGetWeather returns a not found error when geocoding has no result", async () => {
  let fetchCount = 0;

  await withStubbedFetch(
    async () => {
      fetchCount++;
      return jsonResponse([]);
    },
    async () => {
      const result = await executeGetWeather(ctx, {
        city: "Atlantide",
        days: 3,
      });

      assertEquals(fetchCount, 1);
      assertEquals(result.success, false);
      assertEquals(result.error, 'Ville "Atlantide" non trouvée');
      assertEquals(typeof result.execution_time_ms, "number");
    },
  );
});

Deno.test("executeGetWeather catches fetch failures and returns an error result", async () => {
  await withStubbedFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const result = await executeGetWeather(ctx, {
        city: "Paris",
      });

      assertEquals(result.success, false);
      assertEquals(result.error, "network down");
      assertEquals(typeof result.execution_time_ms, "number");
    },
  );
});