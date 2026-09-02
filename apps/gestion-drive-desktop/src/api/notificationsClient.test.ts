// Tests du client notifications/préférences (mode navigateur) —
// logique DND, filtrage par module, centre in-app, conversions horaires.

import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetBrowserMocks,
  DEFAULT_PREFERENCES,
  clearNotifications,
  getPreferences,
  isDndActive,
  listNotifications,
  markNotificationsRead,
  minutesToTime,
  sendNotification,
  setDoNotDisturb,
  setPreferences,
  shouldDeliverNatively,
  timeToMinutes,
} from "./notificationsClient";
import type { AppPreferences, DoNotDisturbPrefs } from "./notificationsClient";

beforeEach(() => {
  __resetBrowserMocks();
});

function prefsWith(mutate: (p: AppPreferences) => void): AppPreferences {
  const p = structuredClone(DEFAULT_PREFERENCES);
  mutate(p);
  return p;
}

describe("isDndActive", () => {
  it("bascule manuelle prioritaire", () => {
    const dnd: DoNotDisturbPrefs = {
      enabled: true,
      schedule_enabled: false,
      start_minutes: 0,
      end_minutes: 0,
    };
    expect(isDndActive(dnd, 12 * 60)).toBe(true);
  });

  it("plage même journée : actif dans [start, end)", () => {
    const dnd: DoNotDisturbPrefs = {
      enabled: false,
      schedule_enabled: true,
      start_minutes: 9 * 60,
      end_minutes: 17 * 60,
    };
    expect(isDndActive(dnd, 8 * 60)).toBe(false);
    expect(isDndActive(dnd, 9 * 60)).toBe(true);
    expect(isDndActive(dnd, 16 * 60 + 59)).toBe(true);
    expect(isDndActive(dnd, 17 * 60)).toBe(false);
  });

  it("plage franchissant minuit (22h → 8h)", () => {
    const dnd: DoNotDisturbPrefs = {
      enabled: false,
      schedule_enabled: true,
      start_minutes: 22 * 60,
      end_minutes: 8 * 60,
    };
    expect(isDndActive(dnd, 23 * 60)).toBe(true);
    expect(isDndActive(dnd, 3 * 60)).toBe(true);
    expect(isDndActive(dnd, 8 * 60)).toBe(false);
    expect(isDndActive(dnd, 12 * 60)).toBe(false);
  });

  it("plage vide (start == end) inactive", () => {
    const dnd: DoNotDisturbPrefs = {
      enabled: false,
      schedule_enabled: true,
      start_minutes: 600,
      end_minutes: 600,
    };
    expect(isDndActive(dnd, 600)).toBe(false);
  });
});

describe("shouldDeliverNatively", () => {
  it("module désactivé → pas d'affichage natif", () => {
    const prefs = prefsWith((p) => {
      p.notifications.pulse = false;
    });
    expect(shouldDeliverNatively(prefs, "pulse", 12 * 60)).toBe(false);
    expect(shouldDeliverNatively(prefs, "mail", 12 * 60)).toBe(true);
  });

  it("system ignore les toggles module mais respecte le DND", () => {
    const prefs = prefsWith((p) => {
      p.notifications.pulse = false;
      p.notifications.mail = false;
      p.notifications.todo = false;
      p.notifications.drive = false;
    });
    expect(shouldDeliverNatively(prefs, "system", 12 * 60)).toBe(true);
    prefs.do_not_disturb.enabled = true;
    expect(shouldDeliverNatively(prefs, "system", 12 * 60)).toBe(false);
  });

  it("DND actif supprime l'affichage natif de tous les modules", () => {
    const prefs = prefsWith((p) => {
      p.do_not_disturb.enabled = true;
    });
    for (const m of ["pulse", "mail", "todo", "drive"] as const) {
      expect(shouldDeliverNatively(prefs, m, 12 * 60)).toBe(false);
    }
  });
});

describe("conversions horaires", () => {
  it("minutesToTime formate en HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(8 * 60)).toBe("08:00");
    expect(minutesToTime(22 * 60 + 5)).toBe("22:05");
  });

  it("minutesToTime borne les valeurs hors plage", () => {
    expect(minutesToTime(-10)).toBe("00:00");
    expect(minutesToTime(5000)).toBe("23:59");
  });

  it("timeToMinutes parse HH:MM et rejette l'invalide", () => {
    expect(timeToMinutes("08:00")).toBe(480);
    expect(timeToMinutes("22:30")).toBe(1350);
    expect(timeToMinutes("n'importe quoi")).toBe(0);
  });

  it("roundtrip time ↔ minutes", () => {
    for (const m of [0, 480, 1320, 1439]) {
      expect(timeToMinutes(minutesToTime(m))).toBe(m);
    }
  });
});

describe("préférences (mock navigateur)", () => {
  it("valeurs par défaut : tous modules activés, DND off", async () => {
    const prefs = await getPreferences();
    expect(prefs.notifications).toEqual({ pulse: true, mail: true, todo: true, drive: true });
    expect(prefs.do_not_disturb.enabled).toBe(false);
    expect(prefs.launch_at_login).toBe(false);
    expect(prefs.sync_paused).toBe(false);
    expect(prefs.drive_auto_connect).toBe(false);
  });

  it("setPreferences persiste dans le mock", async () => {
    const updated = prefsWith((p) => {
      p.notifications.mail = false;
      p.poll_interval_secs = 120;
    });
    await setPreferences(updated);
    const reloaded = await getPreferences();
    expect(reloaded.notifications.mail).toBe(false);
    expect(reloaded.poll_interval_secs).toBe(120);
  });

  it("setDoNotDisturb bascule uniquement le flag", async () => {
    await setDoNotDisturb(true);
    const prefs = await getPreferences();
    expect(prefs.do_not_disturb.enabled).toBe(true);
    expect(prefs.notifications.pulse).toBe(true);
  });
});

describe("centre de notifications (mock navigateur)", () => {
  it("sendNotification alimente le centre, la plus récente en tête", async () => {
    await sendNotification("pulse", "Message 1");
    await sendNotification("mail", "Message 2", "corps");
    const snap = await listNotifications();
    expect(snap.items).toHaveLength(2);
    expect(snap.items[0].title).toBe("Message 2");
    expect(snap.items[0].body).toBe("corps");
    expect(snap.unread_count).toBe(2);
  });

  it("le centre enregistre même quand le module est désactivé (natif supprimé)", async () => {
    await setPreferences(
      prefsWith((p) => {
        p.notifications.todo = false;
      }),
    );
    const rec = await sendNotification("todo", "Tâche due");
    expect(rec.delivered_natively).toBe(false);
    const snap = await listNotifications();
    expect(snap.items).toHaveLength(1);
  });

  it("DND actif : enregistré in-app, non délivré nativement", async () => {
    await setDoNotDisturb(true);
    const rec = await sendNotification("drive", "Sync terminée");
    expect(rec.delivered_natively).toBe(false);
    const snap = await listNotifications();
    expect(snap.do_not_disturb_active).toBe(true);
    expect(snap.items).toHaveLength(1);
  });

  it("markNotificationsRead cible une notification ou toutes", async () => {
    const a = await sendNotification("pulse", "A");
    await sendNotification("mail", "B");

    expect(await markNotificationsRead(a.id)).toBe(1);
    let snap = await listNotifications();
    expect(snap.unread_count).toBe(1);

    expect(await markNotificationsRead()).toBe(1);
    snap = await listNotifications();
    expect(snap.unread_count).toBe(0);
  });

  it("clearNotifications vide l'historique", async () => {
    await sendNotification("system", "Test");
    await clearNotifications();
    const snap = await listNotifications();
    expect(snap.items).toHaveLength(0);
    expect(snap.unread_count).toBe(0);
  });
});
