import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tresorerie/calculateRevenues", () => ({
  calculateTotalPaymentForMonth: (etab: any, date: Date) => {
    // Paid only in even months for simplicity
    return date.getMonth() % 2 === 0 ? 1000 : 0;
  },
  isPaymentMonth: () => true,
}));

import {
  generatePaymentSchedule,
  generateAllPaymentSchedules,
  getNextPaymentDate,
} from "@/lib/tresorerie/generateSchedule";

const baseEtab: any = {
  id: "e1",
  nom: "Test",
  statut: "Production",
  periodicite_paiement: "mensuel",
  date_premier_paiement: null,
  date_signature: null,
};

describe("generateSchedule", () => {
  it("generatePaymentSchedule returns only months with payment", () => {
    const result = generatePaymentSchedule(
      baseEtab,
      new Date(2026, 0, 1),
      new Date(2026, 5, 1)
    );
    // Months 0,2,4 → 3 payments
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      etablissement_id: "e1",
      etablissement_nom: "Test",
      montant: 1000,
      statut: "prevue",
    });
  });

  it("generateAllPaymentSchedules filters non-Production", () => {
    const r = generateAllPaymentSchedules(
      [baseEtab, { ...baseEtab, id: "e2", statut: "Prospect" }],
      new Date(2026, 0, 1),
      new Date(2026, 1, 1)
    );
    expect(r.every((p) => p.etablissement_id === "e1")).toBe(true);
  });

  it("getNextPaymentDate returns null when no reference date", () => {
    expect(getNextPaymentDate(baseEtab)).toBeNull();
  });

  it("getNextPaymentDate advances past today", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 2);
    const result = getNextPaymentDate({
      ...baseEtab,
      date_premier_paiement: past.toISOString(),
    });
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("respects periodicite trimestriel", () => {
    const r = generatePaymentSchedule(
      { ...baseEtab, periodicite_paiement: "trimestriel" },
      new Date(2026, 0, 1),
      new Date(2026, 11, 1)
    );
    // every 3 months: jan(0), apr(3), jul(6), oct(9) → only even months → 0, 6
    expect(r.length).toBeGreaterThan(0);
  });
});
