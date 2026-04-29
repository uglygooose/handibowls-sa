import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("server-only", () => ({}));

let mockPathname = "/play";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { InstallPromptToast } from "@/components/player/InstallPromptToast";

// Phase 8f-2 — eligibility + render-path coverage for InstallPromptToast.
//
// Scope:
//   • Eligibility gates — installed / dismissed-cooldown / loadCount /
//     scorecardOpened / standalone-mode / scorecard-route suppression
//   • Render paths — Android (deferredPrompt) vs iOS (UA fallback)
//   • Action handlers — install button calls prompt() + records outcome,
//     dismiss button writes dismissedAt + hides
//   • Storage hygiene — sessionStorage gate prevents StrictMode
//     double-counting
//
// Storage / window state is freshened per test in beforeEach.

const STORAGE_KEYS = {
  loadCount: "handibowls.installprompt.loadCount",
  scorecardOpened: "handibowls.installprompt.scorecardOpened",
  dismissedAt: "handibowls.installprompt.dismissedAt",
  installedAt: "handibowls.installprompt.installedAt",
  loadIncrementedThisSession:
    "handibowls.installprompt.loadIncrementedThisSession",
};

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
}

function setStandalone(value: boolean) {
  // matchMedia stub — return a MediaQueryList-shaped object for the
  // (display-mode: standalone) probe used inside the component.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? value : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

type FakePromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function makeBeforeInstallPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted",
): FakePromptEvent {
  const event = new Event("beforeinstallprompt") as FakePromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  // Fresh promise so each test sees the value when it awaits.
  Object.defineProperty(event, "userChoice", {
    value: Promise.resolve({ outcome, platform: "web" }),
  });
  return event;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockPathname = "/play";
  setUserAgent(ANDROID_UA);
  setStandalone(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InstallPromptToast — eligibility gates", () => {
  it("does NOT render when loadCount < 2 (even with everything else satisfied)", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "0");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    render(<InstallPromptToast />);
    // Mount increments to 1 → still < 2.
    fireEvent(window, makeBeforeInstallPromptEvent());
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEYS.loadCount)).toBe("1");
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("does NOT render when scorecardOpened is unset", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("does NOT render when installedAt is set (permanent skip)", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    localStorage.setItem(
      STORAGE_KEYS.installedAt,
      new Date().toISOString(),
    );
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("does NOT render within the 14-day cooldown after dismiss", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    // Dismissed 1 day ago.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEYS.dismissedAt, oneDayAgo);
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("DOES render after the 14-day cooldown expires", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    const fifteenDaysAgo = new Date(
      Date.now() - 15 * 24 * 60 * 60 * 1000,
    ).toISOString();
    localStorage.setItem(STORAGE_KEYS.dismissedAt, fifteenDaysAgo);
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='install-prompt-toast']"),
      ).not.toBeNull();
    });
  });

  it("does NOT render when display-mode is standalone (already installed PWA)", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    setStandalone(true);
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("suppresses on the scorecard route itself even when otherwise eligible", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    mockPathname = "/tournaments/abc/matches/xyz";
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("flips scorecardOpened when the user visits a scorecard route", () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    mockPathname = "/tournaments/abc/matches/xyz";
    render(<InstallPromptToast />);
    expect(localStorage.getItem(STORAGE_KEYS.scorecardOpened)).toBe("1");
  });
});

describe("InstallPromptToast — render paths", () => {
  it("Android: renders Install button with Download icon when deferredPrompt is captured", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    setUserAgent(ANDROID_UA);
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    await waitFor(() => {
      const root = document.querySelector("[data-slot='install-prompt-toast']");
      expect(root).not.toBeNull();
      expect(root?.getAttribute("data-mode")).toBe("android");
    });
    expect(
      document.querySelector("[data-slot='install-cta']"),
    ).not.toBeNull();
    expect(
      document
        .querySelector("[data-slot='install-prompt-body']")
        ?.textContent?.toLowerCase(),
    ).toContain("offline scoring");
  });

  it("iOS: renders instructional copy (Share → Add to Home Screen) with no Install button", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    setUserAgent(IOS_UA);
    render(<InstallPromptToast />);
    // No beforeinstallprompt fires on iOS — eligibility is recomputed
    // after the layout effect; trigger via a pathname change cycle by
    // re-rendering the same path (no-op in production but flushes
    // useEffect deps via act).
    await waitFor(() => {
      const root = document.querySelector("[data-slot='install-prompt-toast']");
      expect(root).not.toBeNull();
      expect(root?.getAttribute("data-mode")).toBe("ios");
    });
    expect(document.querySelector("[data-slot='install-cta']")).toBeNull();
    expect(
      document
        .querySelector("[data-slot='install-prompt-body']")
        ?.textContent?.toLowerCase(),
    ).toContain("share");
  });

  it("non-iOS, non-Android (desktop without prompt): does NOT render", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    );
    render(<InstallPromptToast />);
    // No beforeinstallprompt event; not iOS UA — eligibility falls.
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });
});

describe("InstallPromptToast — action handlers", () => {
  it("Android Install button calls deferredPrompt.prompt() and hides on accepted", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    setUserAgent(ANDROID_UA);
    render(<InstallPromptToast />);
    const event = makeBeforeInstallPromptEvent("accepted");
    await act(async () => {
      window.dispatchEvent(event);
    });
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='install-cta']"),
      ).not.toBeNull();
    });

    const cta = document.querySelector(
      "[data-slot='install-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      cta.click();
      // Let userChoice resolve.
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("Android Install: dismissed outcome writes dismissedAt", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    render(<InstallPromptToast />);
    const event = makeBeforeInstallPromptEvent("dismissed");
    await act(async () => {
      window.dispatchEvent(event);
    });
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='install-cta']"),
      ).not.toBeNull();
    });

    const cta = document.querySelector(
      "[data-slot='install-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      cta.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(localStorage.getItem(STORAGE_KEYS.dismissedAt)).not.toBeNull();
  });

  it("Dismiss X writes dismissedAt and hides immediately", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='install-dismiss']"),
      ).not.toBeNull();
    });

    const dismiss = document.querySelector(
      "[data-slot='install-dismiss']",
    ) as HTMLButtonElement;
    fireEvent.click(dismiss);

    expect(localStorage.getItem(STORAGE_KEYS.dismissedAt)).not.toBeNull();
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });

  it("appinstalled event writes installedAt and hides", async () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "5");
    localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
    render(<InstallPromptToast />);
    await act(async () => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='install-prompt-toast']"),
      ).not.toBeNull();
    });

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(localStorage.getItem(STORAGE_KEYS.installedAt)).not.toBeNull();
    expect(
      document.querySelector("[data-slot='install-prompt-toast']"),
    ).toBeNull();
  });
});

describe("InstallPromptToast — load counter hygiene", () => {
  it("increments loadCount only once per session (StrictMode-safe via sessionStorage gate)", () => {
    expect(localStorage.getItem(STORAGE_KEYS.loadCount)).toBeNull();

    const { unmount } = render(<InstallPromptToast />);
    expect(localStorage.getItem(STORAGE_KEYS.loadCount)).toBe("1");
    expect(
      sessionStorage.getItem(STORAGE_KEYS.loadIncrementedThisSession),
    ).toBe("1");

    // Re-mount within the same session — counter must NOT advance.
    unmount();
    render(<InstallPromptToast />);
    expect(localStorage.getItem(STORAGE_KEYS.loadCount)).toBe("1");
  });

  it("a new session (sessionStorage cleared) increments to 2", () => {
    localStorage.setItem(STORAGE_KEYS.loadCount, "1");
    // Session reset.
    sessionStorage.clear();
    render(<InstallPromptToast />);
    expect(localStorage.getItem(STORAGE_KEYS.loadCount)).toBe("2");
  });
});
