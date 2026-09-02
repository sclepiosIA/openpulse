import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCompareForecastVsActual,
  executeGetSalesForecast,
} from "./forecasting-tools.ts";

const NativeDate = globalThis.Date;

function installFixedDate(iso: string): () => void {
  const fixedTime = NativeDate.parse(iso);

  class FixedDate extends NativeDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedTime;
    }
  }

  globalThis.Date = FixedDate as DateConstructor;
  return () => {
    globalThis.Date = NativeDate;
  };
}

function makeDeals(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    amount: (index + 1) * 1000,
  }));
}

function createRpcStub(
  handler: (name: string, params: Record<string, unknown>, callNumber: number) => unknown,
) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];

  return {
    calls,
    supabase: {
      rpc(name: string, params: Record<string, unknown>) {
        calls.push({ name, params });
        return handler(name, params, calls.length);
      },
    },
  };
}

Deno.test("module loads and exports forecasting tool functions", async () => {
  const mod = await import("./forecasting-tools.ts");

  assertExists(mod.executeGetSalesForecast);
  assertExists(mod.executeCompareForecastVsActual);
  assertEquals(typeof mod.executeGetSalesForecast, "function");
  assertEquals(typeof mod.executeCompareForecastVsActual, "function");
});

Deno.test("executeGetSalesForecast calls get_sales_forecast with current quarter range and trims deal lists", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase, calls } = createRpcStub(() => ({
      data: {
        kpis: {
          pipeline_weighted: 125000,
          won_total: 45000,
          target_total: 200000,
        },
        top_deals: makeDeals(12, "top"),
        at_risk_deals: makeDeals(11, "risk"),
        by_quarter: [{ quarter: "2024-Q2", weighted: 125000 }],
        by_commercial: [{ commercial: "Alice", weighted: 70000 }],
        by_phase_group: [{ phase_group: "Negotiation", weighted: 55000 }],
      },
      error: null,
    }));

    const result = await executeGetSalesForecast(
      { supabase, userId: "user-1" } as any,
      { range: "current_quarter" },
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0], {
      name: "get_sales_forecast",
      params: {
        p_start: "2024-04-01",
        p_end: "2024-06-30",
      },
    });

    assertEquals(result.success, true);
    assertEquals((result as any).data.range, {
      start: "2024-04-01",
      end: "2024-06-30",
      label: "current_quarter",
    });
    assertEquals((result as any).data.kpis, {
      pipeline_weighted: 125000,
      won_total: 45000,
      target_total: 200000,
    });
    assertEquals((result as any).data.top_deals.length, 10);
    assertEquals((result as any).data.top_deals[0].id, "top-1");
    assertEquals((result as any).data.top_deals[9].id, "top-10");
    assertEquals((result as any).data.at_risk_deals.length, 10);
    assertEquals((result as any).data.at_risk_deals[9].id, "risk-10");
    assertEquals((result as any).data.by_quarter, [{ quarter: "2024-Q2", weighted: 125000 }]);
    assertEquals((result as any).data.by_commercial, [{ commercial: "Alice", weighted: 70000 }]);
    assertEquals((result as any).data.by_phase_group, [
      { phase_group: "Negotiation", weighted: 55000 },
    ]);
    assertEquals(typeof result.execution_time_ms, "number");
  } finally {
    restoreDate();
  }
});

Deno.test("executeGetSalesForecast computes supported date ranges", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const cases = [
      {
        args: {},
        expectedLabel: "year",
        expectedStart: "2024-01-01",
        expectedEnd: "2024-12-31",
      },
      {
        args: { range: "year" as const },
        expectedLabel: "year",
        expectedStart: "2024-01-01",
        expectedEnd: "2024-12-31",
      },
      {
        args: { range: "current_quarter" as const },
        expectedLabel: "current_quarter",
        expectedStart: "2024-04-01",
        expectedEnd: "2024-06-30",
      },
      {
        args: { range: "next_quarter" as const },
        expectedLabel: "next_quarter",
        expectedStart: "2024-07-01",
        expectedEnd: "2024-09-30",
      },
      {
        args: { range: "rolling_12" as const },
        expectedLabel: "rolling_12",
        expectedStart: "2023-11-01",
        expectedEnd: "2024-10-31",
      },
    ];

    for (const testCase of cases) {
      const { supabase, calls } = createRpcStub(() => ({
        data: {
          kpis: {},
          top_deals: [],
          at_risk_deals: [],
          by_quarter: [],
          by_commercial: [],
          by_phase_group: [],
        },
        error: null,
      }));

      const result = await executeGetSalesForecast(
        { supabase, userId: "user-1" } as any,
        testCase.args,
      );

      assertEquals(result.success, true);
      assertEquals(calls.length, 1);
      assertEquals(calls[0].name, "get_sales_forecast");
      assertEquals(calls[0].params, {
        p_start: testCase.expectedStart,
        p_end: testCase.expectedEnd,
      });
      assertEquals((result as any).data.range, {
        start: testCase.expectedStart,
        end: testCase.expectedEnd,
        label: testCase.expectedLabel,
      });
    }
  } finally {
    restoreDate();
  }
});

Deno.test("executeGetSalesForecast returns empty arrays when forecast deal lists are missing", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase } = createRpcStub(() => ({
      data: {
        kpis: { pipeline_weighted: 10 },
        by_quarter: [{ quarter: "2024-Q1", weighted: 10 }],
      },
      error: null,
    }));

    const result = await executeGetSalesForecast(
      { supabase, userId: "user-1" } as any,
      { range: "year" },
    );

    assertEquals(result.success, true);
    assertEquals((result as any).data.top_deals, []);
    assertEquals((result as any).data.at_risk_deals, []);
    assertEquals((result as any).data.kpis, { pipeline_weighted: 10 });
  } finally {
    restoreDate();
  }
});

Deno.test("executeGetSalesForecast returns failure result when RPC returns an Error", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase, calls } = createRpcStub(() => ({
      data: null,
      error: new Error("RPC unavailable"),
    }));

    const result = await executeGetSalesForecast(
      { supabase, userId: "user-1" } as any,
      { range: "year" },
    );

    assertEquals(calls.length, 1);
    assertEquals(result.success, false);
    assertEquals((result as any).error, "RPC unavailable");
    assertEquals(typeof result.execution_time_ms, "number");
  } finally {
    restoreDate();
  }
});

Deno.test("executeGetSalesForecast returns default failure message for non-Error thrown value", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase } = createRpcStub(() => ({
      data: null,
      error: "database timeout",
    }));

    const result = await executeGetSalesForecast(
      { supabase, userId: "user-1" } as any,
      { range: "year" },
    );

    assertEquals(result.success, false);
    assertEquals((result as any).error, "get_sales_forecast failed");
  } finally {
    restoreDate();
  }
});

Deno.test("executeCompareForecastVsActual computes conversion, target progress and target gap", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase, calls } = createRpcStub(() => ({
      data: {
        kpis: {
          pipeline_weighted: "2500",
          won_total: "1000",
          target_total: "4000",
        },
      },
      error: null,
    }));

    const result = await executeCompareForecastVsActual(
      { supabase, userId: "user-1" } as any,
      { range: "next_quarter" },
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0], {
      name: "get_sales_forecast",
      params: {
        p_start: "2024-07-01",
        p_end: "2024-09-30",
      },
    });

    assertEquals(result.success, true);
    assertEquals((result as any).data, {
      range: {
        start: "2024-07-01",
        end: "2024-09-30",
      },
      weighted_pipeline: 2500,
      won_actual: 1000,
      target: 4000,
      conversion_pct: 40,
      target_progress_pct: 25,
      gap_to_target: 3000,
    });
    assertEquals(typeof result.execution_time_ms, "number");
  } finally {
    restoreDate();
  }
});

Deno.test("executeCompareForecastVsActual handles zero weighted pipeline and missing target", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase } = createRpcStub(() => ({
      data: {
        kpis: {
          pipeline_weighted: 0,
          won_total: 50,
          target_total: 0,
        },
      },
      error: null,
    }));

    const result = await executeCompareForecastVsActual(
      { supabase, userId: "user-1" } as any,
      { range: "rolling_12" },
    );

    assertEquals(result.success, true);
    assertEquals((result as any).data.range, {
      start: "2023-11-01",
      end: "2024-10-31",
    });
    assertEquals((result as any).data.weighted_pipeline, 0);
    assertEquals((result as any).data.won_actual, 50);
    assertEquals((result as any).data.target, 0);
    assertEquals((result as any).data.conversion_pct, 0);
    assertEquals((result as any).data.target_progress_pct, null);
    assertEquals((result as any).data.gap_to_target, null);
  } finally {
    restoreDate();
  }
});

Deno.test("executeCompareForecastVsActual treats missing KPI payload as zero values", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase } = createRpcStub(() => ({
      data: {},
      error: null,
    }));

    const result = await executeCompareForecastVsActual(
      { supabase, userId: "user-1" } as any,
      {},
    );

    assertEquals(result.success, true);
    assertEquals((result as any).data, {
      range: {
        start: "2024-01-01",
        end: "2024-12-31",
      },
      weighted_pipeline: 0,
      won_actual: 0,
      target: 0,
      conversion_pct: 0,
      target_progress_pct: null,
      gap_to_target: null,
    });
  } finally {
    restoreDate();
  }
});

Deno.test("executeCompareForecastVsActual returns failure result when RPC throws", async () => {
  const restoreDate = installFixedDate("2024-05-15T12:00:00.000Z");

  try {
    const { supabase, calls } = createRpcStub(() => {
      throw new Error("forecast RPC failed");
    });

    const result = await executeCompareForecastVsActual(
      { supabase, userId: "user-1" } as any,
      { range: "current_quarter" },
    );

    assertEquals(calls.length, 1);
    assertEquals(result.success, false);
    assertEquals((result as any).error, "forecast RPC failed");
    assertEquals(typeof result.execution_time_ms, "number");
  } finally {
    restoreDate();
  }
});