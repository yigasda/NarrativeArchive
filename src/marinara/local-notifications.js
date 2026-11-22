// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/client/src/lib/local-notifications.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - the notification's body ("Open Marinara to read it.") and icon ("/icon-192.png") are SillyTavern's here: MESSAGE_NOTIFICATION { body, icon }, used in the three places the original wrote them out;
//   - ./android-bridge is not ported (Marinara's Android app): getAndroidBridgeToken() gives null, so the token-less calls of the original are the ones taken. The Android bridge functions stay as they are and answer "unsupported" when there is no bridge; nothing else
// (Marinara's Android app hands its pages a token; there is no such app here, so there is never one)
const getAndroidBridgeToken = () => null;

/** What the notification says under its title, and its picture: SillyTavern's, not Marinara's. */
export const MESSAGE_NOTIFICATION = { body: "실리에서 읽어 보세요.", icon: "/img/apple-icon-192x192.png" };

function getBrowserNotificationPermission() {
  if (typeof window === "undefined") return "unsupported";
  if (window.isSecureContext === false) return "insecure";
  if (!("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

function getAndroidNotificationBridge() {
  if (typeof window === "undefined") return null;
  return (window).MarinaraAndroid ?? null;
}

export function hasNativeNotificationBridge() {
  const bridge = getAndroidNotificationBridge();
  return (
    typeof bridge?.getNotificationPermission === "function" &&
    typeof bridge.requestNotificationPermission === "function" &&
    typeof bridge.showNotification === "function"
 );
}

function normalizeNativePermission(value) {
  return value === "default" || value === "denied" || value === "granted" ? value : "unsupported";
}

export function getNativeNotificationPermission() {
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.getNotificationPermission !== "function") return "unsupported";
  const token = getAndroidBridgeToken();
  return normalizeNativePermission(
    token ? bridge.getNotificationPermission(token) : bridge.getNotificationPermission(),
 );
}

export async function requestNativeNotificationPermission() {
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.requestNotificationPermission !== "function") return "unsupported";
  const current = getNativeNotificationPermission();
  if (current === "granted") return current;

  return new Promise((resolve) => {
    const finish = (permission) => {
      window.removeEventListener("marinara:native-notification-permission", handlePermission);
      window.clearTimeout(timeoutId);
      resolve(permission);
    };
    const handlePermission = (event) => {
      finish(normalizeNativePermission((event).detail));
    };
    // Resolve a slow bridge request for the current caller, but leave the one-shot
    // listener installed so a late Android result is still consumed and cleaned up.
    const timeoutId = window.setTimeout(() => resolve(getNativeNotificationPermission()), 30_000);
    window.addEventListener("marinara:native-notification-permission", handlePermission, { once: true });
    const token = getAndroidBridgeToken();
    if (token) bridge.requestNotificationPermission?.(token);
    else bridge.requestNotificationPermission?.();
  });
}

async function requestBrowserNotificationPermission() {
  const current = getBrowserNotificationPermission();
  if (current === "insecure" || current === "unsupported") return current;
  if (window.Notification.permission !== "default") return window.Notification.permission;
  return window.Notification.requestPermission();
}

export async function getLocalNotificationPermission() {
  return getBrowserNotificationPermission();
}

export async function requestLocalNotificationPermission() {
  return requestBrowserNotificationPermission();
}

function isAppFocusedForNotifications() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

function resolveMessageNotificationTitle(title, characterName) {
  const explicitTitle = typeof title === "string" ? title.trim() : "";
  if (explicitTitle) return explicitTitle.slice(0, 100);
  const name = typeof characterName === "string" && characterName.trim() ? characterName.trim() : "Character";
  return `New message from ${name.slice(0, 80)}`;
}

export async function showLocalMessageNotification({
  enabled,
  characterName,
  title,
  tag,
}) {
  if (!enabled || isAppFocusedForNotifications()) return false;
  if (getBrowserNotificationPermission() !== "granted") return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  const notificationTitle = resolveMessageNotificationTitle(title, characterName);
  const options = {
    body: MESSAGE_NOTIFICATION.body,
    icon: MESSAGE_NOTIFICATION.icon,
    tag,
    // Each completed reply should alert, even when replacing this chat's notification.
    renotify: Boolean(tag),
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (isAppFocusedForNotifications()) return false;
    if (registration?.active && typeof registration.showNotification === "function") {
      await registration.showNotification(notificationTitle, options);
      return true;
    }
  } catch (error) {
    console.warn("[Notifications] Service worker delivery failed:", error);
  }

  if (isAppFocusedForNotifications()) return false;
  try {
    // Development and browsers without an active worker can use desktop notifications.
    const notification = new window.Notification(notificationTitle, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (error) {
    console.warn("[Notifications] Browser delivery failed:", error);
    return false;
  }
}

export function showNativeMessageNotification({
  enabled,
  characterName,
  title,
  tag,
}) {
  if (!enabled || isAppFocusedForNotifications()) return false;
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.showNotification !== "function" || getNativeNotificationPermission() !== "granted") {
    return false;
  }
  const notificationTitle = resolveMessageNotificationTitle(title, characterName);
  const notificationTag = tag ?? "message";
  const token = getAndroidBridgeToken();
  if (token) bridge.showNotification(token, notificationTitle, MESSAGE_NOTIFICATION.body, notificationTag);
  else bridge.showNotification(notificationTitle, MESSAGE_NOTIFICATION.body, notificationTag);
  return true;
}
