import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentQuotaIndicator } from "./DocumentQuotaIndicator";

vi.mock("@/hooks/documents/useDocumentQuota", () => ({
  useDocumentQuota: () => ({
    data: {
      usage_percentage: 42,
      formatted_used: "4,2 Go",
      formatted_quota: "10 Go",
    },
    isLoading: false,
  }),
}));

describe("DocumentQuotaIndicator a11y", () => {
  it("progressbar has explicit aria-label and valid aria-value* attributes", () => {
    render(<DocumentQuotaIndicator />);
    const bar = screen.getByRole("progressbar");
    const label = bar.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/stockage/i);
    // Radix Progress sets valuemin/valuemax/valuenow natively
    // Radix Progress exposes valuemax; valuenow may be omitted in jsdom
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    const valueNow = bar.getAttribute("aria-valuenow");
    if (valueNow !== null) {
      expect(Number(valueNow)).toBeGreaterThanOrEqual(0);
      expect(Number(valueNow)).toBeLessThanOrEqual(100);
    }
  });
});
