"use client";

import { getAppVersion } from "./versionManager";

export interface DeviceDetails {
  PlateForm: string;
  UserAgent: string;
  AppVersion: string;
  Browser: string;
  DeviceId: string;
  Brand: string;
  DeviceType: string;
  OsVersion: string;
  Model: string;
  Manufacturer: string;
  AppVer: string;
  AppVerCode: string;
  OneSignal_AppId: string;
  OneSignal_SubscriptionId: string;
  OneSignal_OneSignalId: string;
}

const SSR_DETAILS: DeviceDetails = {
  PlateForm: "WEB",
  UserAgent: "",
  AppVersion: "",
  Browser: "",
  DeviceId: "",
  Brand: "",
  DeviceType: "",
  OsVersion: "",
  Model: "",
  Manufacturer: "",
  AppVer: "",
  AppVerCode: "",
  OneSignal_AppId: "",
  OneSignal_SubscriptionId: "",
  OneSignal_OneSignalId: "",
};

// First capture group of a UA match, or null.
const matchGroup = (ua: string, pattern: RegExp): string | null =>
  ua.match(pattern)?.[1] ?? null;

export function getDeviceDetails(): DeviceDetails {
  if (typeof window === "undefined") return SSR_DETAILS;

  const ua = navigator.userAgent || "";

  // Edge/Opera UA also contains "Chrome/" — check them first.
  let browser = "Unknown";
  let browserVersion = "";
  if (ua.includes("Edg/")) {
    browser = "Edge";
    browserVersion = matchGroup(ua, /Edg\/([\d.]+)/) ?? "";
  } else if (ua.includes("OPR/")) {
    browser = "Opera";
    browserVersion = matchGroup(ua, /OPR\/([\d.]+)/) ?? "";
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome";
    browserVersion = matchGroup(ua, /Chrome\/([\d.]+)/) ?? "";
  } else if (ua.includes("Firefox/")) {
    browser = "Firefox";
    browserVersion = matchGroup(ua, /Firefox\/([\d.]+)/) ?? "";
  } else if (ua.includes("Safari/")) {
    browser = "Safari";
    browserVersion = matchGroup(ua, /Version\/([\d.]+)/) ?? "";
  }
  const shortUserAgent = browserVersion
    ? `${browser}/${browserVersion.split(".")[0]}`
    : browser;

  let deviceType = "Desktop";
  if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";
  else if (/mobile|android|iphone|ipod/i.test(ua)) deviceType = "Mobile";

  let osVersion = "Unknown";
  const androidVer = matchGroup(ua, /Android ([0-9.]+)/i);
  const iphoneVer = matchGroup(ua, /iPhone OS ([0-9_]+)/i);
  const macVer = matchGroup(ua, /Mac OS X ([0-9_]+)/i);
  if (/Windows NT 10.0/i.test(ua)) osVersion = "Windows 10/11";
  else if (/Windows NT 6.1/i.test(ua)) osVersion = "Windows 7";
  else if (androidVer) osVersion = `Android ${androidVer}`;
  else if (iphoneVer) osVersion = `iOS ${iphoneVer.replace(/_/g, ".")}`;
  else if (macVer) osVersion = `macOS ${macVer.replace(/_/g, ".")}`;
  else if (/Linux/i.test(ua)) osVersion = "Linux";

  // UA-based brand lookup — first hit wins.
  const BRAND_MAP: [RegExp, string][] = [
    [/iPhone|iPad|Macintosh/i, "Apple"],
    [/Samsung/i, "Samsung"],
    [/OnePlus/i, "OnePlus"],
    [/Xiaomi|Mi |Redmi|POCO/i, "Xiaomi"],
    [/OPPO/i, "OPPO"],
    [/vivo/i, "Vivo"],
    [/Realme/i, "Realme"],
    [/Motorola/i, "Motorola"],
  ];
  const brand = BRAND_MAP.find(([re]) => re.test(ua))?.[1] ?? "";

  let model = "";
  if (/iPhone/i.test(ua)) model = "iPhone";
  else if (/iPad/i.test(ua)) model = "iPad";
  else if (/Android/i.test(ua)) {
    model = (
      matchGroup(ua, /Android[^;]*;\s*(?:wv;\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i) ?? ""
    ).trim();
  }

  // Persistent per-device id — survives reinstall-less reloads.
  let deviceId = localStorage.getItem("PWA_DeviceId");
  if (!deviceId) {
    deviceId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem("PWA_DeviceId", deviceId);
  }

  // Deployed version from version.json (auto-bumped by `npm run build`),
  // not env vars — the same source the update checker uses.
  const appVersion = getAppVersion();
  const [maj = 0, min = 0, pat = 0] = appVersion.split(".").map(Number);
  const appVersionCode = String(maj * 10000 + min * 100 + pat);

  return {
    PlateForm: "WEB",
    UserAgent: shortUserAgent,
    AppVersion: appVersion,
    Browser: browser,
    DeviceId: deviceId,
    Brand: brand,
    DeviceType: deviceType,
    OsVersion: osVersion,
    Model: model,
    Manufacturer: brand,
    AppVer: appVersion,
    AppVerCode: appVersionCode,
    // OneSignal fields — populate from the SDK when integrated.
    OneSignal_AppId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
    OneSignal_SubscriptionId: "",
    OneSignal_OneSignalId: "",
  };
}
