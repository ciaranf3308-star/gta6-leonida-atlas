import { Component, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/oswald/500.css";
import App from "./app/App";
import { AccountExtension } from "./capabilities/AccountExtension";
import { initializeAnalytics } from "./app/analytics";
import { AnalyticsConsent } from "./app/AnalyticsConsent";
import "./app/atlas.css";
import "./features/project/project.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="full-loading">
        <h1>Atlas could not open this view</h1>
        <p>Your local data has not been reset.</p>
        <button
          className="button"
          onClick={() => {
            location.href = import.meta.env.BASE_URL;
          }}
        >
          Return to the map
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
initializeAnalytics(import.meta.env.VITE_ANALYTICS_ID);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <AccountExtension />
      <AnalyticsConsent />
    </ErrorBoundary>
  </StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        // A new deploy must reach the phone: ask for an update on
        // every launch (the browser also checks on navigation, but an
        // installed PWA can sit for a day without one), and when the
        // new worker takes over, reload once so the new shell — and
        // its new tile URLs — load. v0.20 went live on the server
        // while phones kept the old worker and old tiles: the reload
        // is what makes an update visible instead of theoretical.
        // No reload on first install (there was no controller yet).
        void registration.update().catch(() => {
          /* Update check is best-effort; the map works without it. */
        });
        const hadController = Boolean(navigator.serviceWorker.controller);
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!hadController || reloading) return;
          reloading = true;
          window.location.reload();
        });
      })
      .catch(() => {
        /* Map and IndexedDB remain usable when caching is unavailable. */
      });
  });
}
