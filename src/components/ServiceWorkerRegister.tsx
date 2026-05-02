"use client";

import { useEffect, useRef, useState } from "react";

const CACHE_PREFIX = "textbook";
const DEV_CLEANUP_KEY = "textbook:dev-sw-cleaned";

export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
        "caches" in window
          ? caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))))
          : Promise.resolve([]),
      ]).then(() => {
        if (navigator.serviceWorker.controller && !window.sessionStorage.getItem(DEV_CLEANUP_KEY)) {
          window.sessionStorage.setItem(DEV_CLEANUP_KEY, "1");
          window.location.reload();
        } else if (!navigator.serviceWorker.controller) {
          window.sessionStorage.removeItem(DEV_CLEANUP_KEY);
        }
      }).catch(() => undefined);
      return;
    }

    let refreshing = false;
    let interval: number | undefined;
    let registrationRef: ServiceWorkerRegistration | null = null;
    let onUpdateFound: (() => void) | undefined;

    function onControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onVisible = () => {
      if (document.visibilityState === "visible") registrationRef?.update().catch(() => undefined);
    };

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
      registrationRef = registration;
      function watchInstallingWorker(worker: ServiceWorker | null) {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker.current = worker;
            setUpdateReady(true);
          }
        });
      }

      watchInstallingWorker(registration.installing);
      onUpdateFound = () => watchInstallingWorker(registration.installing);
      registration.addEventListener("updatefound", onUpdateFound);
      registration.update().catch(() => undefined);
      interval = window.setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000);
      document.addEventListener("visibilitychange", onVisible);
    }).catch(() => undefined);

    return () => {
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (registrationRef && onUpdateFound) registrationRef.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[70] rounded-2xl border border-amber-200 bg-stone-950 p-4 text-white shadow-2xl md:bottom-6 md:left-auto md:right-6 md:w-96">
      <p className="text-sm font-semibold">A new version is ready.</p>
      <p className="mt-1 text-sm text-stone-300">Refresh to use the latest deployed app and clear the old PWA cache.</p>
      <button
        disabled={refreshing}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:bg-amber-300 disabled:opacity-90"
        onClick={() => {
          setRefreshing(true);
          waitingWorker.current?.postMessage({ type: "SKIP_WAITING" });
          navigator.serviceWorker.getRegistration().then((registration) => {
            registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.setTimeout(() => window.location.reload(), 1200);
          }).catch(() => window.location.reload());
        }}
      >
        {refreshing ? <span className="size-3.5 animate-spin rounded-full border-2 border-stone-950/25 border-t-stone-950" aria-hidden="true" /> : null}
        {refreshing ? "Refreshing..." : "Refresh now"}
      </button>
    </div>
  );
}
