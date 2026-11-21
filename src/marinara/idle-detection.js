// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/client/src/hooks/use-idle-detection.ts
// and packages/client/src/lib/user-presence-activity.ts (restoreAvailableAfterUserMessage), at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: the React hook is a plain start function that returns its stop function; the user
// status comes from a store given as an argument ({ getState() → { userStatus, userStatusManual, setUserStatus } })
// instead of Marinara's UI store. The timings, the events and the rules are as they are.
// ──────────────────────────────────────────────
// Hook: Idle Detection
// ──────────────────────────────────────────────
// Detects user inactivity (mouse, keyboard, touch) and
// auto-sets status to "idle" after 10 minutes, reverting
// to "active" when the user returns.

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function startIdleDetection(useUIStore, win = globalThis.window, doc = globalThis.document) {
  let timer;
  let isIdle = false;

  const resetTimer = () => {
    const { userStatus, userStatusManual, setUserStatus } = useUIStore.getState();
    // Only manage idle if the user's manual choice is "active"
    if (userStatusManual !== "active") return;

    if (isIdle || userStatus === "idle") {
      isIdle = false;
      setUserStatus("active");
    }

    clearTimeout(timer);
    timer = setTimeout(() => {
      const state = useUIStore.getState();
      if (state.userStatusManual === "active") {
        isIdle = true;
        state.setUserStatus("idle");
      }
    }, IDLE_TIMEOUT_MS);
  };

  // Activity events
  const events = ["pointermove", "pointerdown", "mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"];
  for (const evt of events) {
    win.addEventListener(evt, resetTimer, { passive: true });
  }

  // Also detect visibility change (tab switch back)
  const onVisibility = () => {
    if (!doc.hidden) resetTimer();
  };
  doc.addEventListener("visibilitychange", onVisibility);

  // Start the timer
  resetTimer();

  return () => {
    clearTimeout(timer);
    for (const evt of events) {
      win.removeEventListener(evt, resetTimer);
    }
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

export function restoreAvailableAfterUserMessage(useUIStore) {
  const { userStatus, userStatusManual, setUserStatus } = useUIStore.getState();

  if (userStatusManual === "active" && userStatus === "idle") {
    setUserStatus("active");
    return "active";
  }

  return userStatus;
}
