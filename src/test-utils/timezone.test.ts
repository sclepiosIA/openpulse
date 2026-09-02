import { localDate, toLocalYMD, setTestNow } from "./timezone";

describe("localDate", () => {
  it.each([
    ["2026-07-06", 2026, 6, 6],
    ["2024-01-01", 2024, 0, 1],
    ["1999-12-31", 1999, 11, 31],
    ["2028-02-29", 2028, 1, 29],
  ])("construit %s à minuit LOCAL (année %i, mois index %i, jour %i)", (iso, year, monthIndex, day) => {
    const d = localDate(iso);
    expect(d.getFullYear()).toBe(year);
    expect(d.getMonth()).toBe(monthIndex);
    expect(d.getDate()).toBe(day);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("ne décale jamais de jour contrairement à new Date('YYYY-MM-DD') en TZ non-UTC", () => {
    const d = localDate("2026-07-06");
    // Le jour local reste bien le 6, quel que soit le fuseau du runner.
    expect(d.getDate()).toBe(6);
    expect(d.getMonth()).toBe(6); // juillet = index 6
  });
});

describe("toLocalYMD", () => {
  it.each([
    [new Date(2026, 6, 6), "2026-07-06"],
    [new Date(2024, 0, 1), "2024-01-01"],
    [new Date(1999, 11, 31), "1999-12-31"],
    [new Date(2026, 8, 5, 23, 59, 59), "2026-09-05"],
  ])("formate %s en YYYY-MM-DD local → %s", (date, expected) => {
    expect(toLocalYMD(date)).toBe(expected);
  });

  it("padde le mois et le jour sur 2 chiffres", () => {
    expect(toLocalYMD(new Date(2026, 2, 4))).toBe("2026-03-04");
  });

  it("est l'inverse exact de localDate (round-trip)", () => {
    const isos = ["2026-07-06", "2024-02-29", "2030-11-30", "2000-01-01"];
    for (const iso of isos) {
      expect(toLocalYMD(localDate(iso))).toBe(iso);
    }
  });

  it("le round-trip via new Date('YYYY-MM-DD') UTC peut flipper, pas via localDate", () => {
    // Assertion métier : localDate garantit la stabilité du jour local.
    const d = localDate("2026-07-06");
    expect(toLocalYMD(d)).toBe("2026-07-06");
  });
});

describe("setTestNow", () => {
  const globalRecord = globalThis as unknown as Record<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalRecord.__TEST_NOW__;
  });

  it("retourne un Date correspondant à l'instant local fourni", () => {
    const d = setTestNow("2026-07-06T09:00:00");
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it("expose le timestamp figé sur globalThis.__TEST_NOW__", () => {
    const d = setTestNow("2026-07-06T09:00:00");
    expect(globalRecord.__TEST_NOW__).toBe(d.getTime());
    expect(typeof globalRecord.__TEST_NOW__).toBe("number");
  });

  it("met à jour __TEST_NOW__ à chaque appel successif", () => {
    const d1 = setTestNow("2026-07-06T09:00:00");
    const d2 = setTestNow("2026-07-07T15:30:00");
    expect(d2.getTime()).toBeGreaterThan(d1.getTime());
    expect(globalRecord.__TEST_NOW__).toBe(d2.getTime());
  });

  it("le Date retourné reste cohérent avec toLocalYMD", () => {
    const d = setTestNow("2026-07-06T23:59:59");
    expect(toLocalYMD(d)).toBe("2026-07-06");
  });
});