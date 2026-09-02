import { describe, it, expect } from "vitest";
import {
  DEFAULT_SIMULATION_PARAMS,
  CENTER_TYPES,
  DPI_TYPES,
  RESELLER_TYPES,
  PALIER_CONFIG,
  SIMULATOR_COLORS,
  LEVIER_NAMES,
  formatEuro,
  formatNumber,
  formatPercent,
  getCenterTypeById,
  getDPITypeById,
  getResellerTypeById,
} from "../simulator-config";

describe("simulator-config constants", () => {
  it("has default simulation params", () => {
    expect(DEFAULT_SIMULATION_PARAMS.passages).toBe(40000);
    expect(DEFAULT_SIMULATION_PARAMS.TARIF_UHCD).toBe(400);
  });
  it("exposes 3 center types", () => {
    expect(CENTER_TYPES).toHaveLength(3);
    expect(CENTER_TYPES.map((c) => c.id)).toEqual(["ch", "chu", "ght"]);
  });
  it("exposes 2 DPI types", () => {
    expect(DPI_TYPES).toHaveLength(2);
  });
  it("exposes 2 reseller types", () => {
    expect(RESELLER_TYPES).toHaveLength(2);
  });
  it("has 4 paliers, last unbounded", () => {
    expect(PALIER_CONFIG).toHaveLength(4);
    expect(PALIER_CONFIG[3].conditionMax).toBe(Infinity);
  });
  it("exposes colors & levier names", () => {
    expect(SIMULATOR_COLORS.blue[500]).toMatch(/^#/);
    expect(LEVIER_NAMES.uhcd).toContain("UHCD");
  });
});

describe("simulator-config formatters", () => {
  it("formatEuro returns euros", () => {
    const s = formatEuro(1234);
    expect(s).toMatch(/€/);
    expect(s).toMatch(/1/);
  });
  it("formatNumber rounds and formats", () => {
    expect(formatNumber(1234.6)).toMatch(/1/);
  });
  it("formatPercent uses default 1 decimal", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
    expect(formatPercent(12, 0)).toBe("12%");
  });
});

describe("simulator-config lookups", () => {
  it("getCenterTypeById returns match or undefined", () => {
    expect(getCenterTypeById("chu")?.name).toContain("CHU");
    expect(getCenterTypeById("nope")).toBeUndefined();
  });
  it("getDPITypeById returns match or undefined", () => {
    expect(getDPITypeById("web")?.baseFrais).toBe(5000);
    expect(getDPITypeById("nope")).toBeUndefined();
  });
  it("getResellerTypeById returns match or undefined", () => {
    expect(getResellerTypeById("softway")?.markup).toBe(0.5);
    expect(getResellerTypeById("nope")).toBeUndefined();
  });
});
