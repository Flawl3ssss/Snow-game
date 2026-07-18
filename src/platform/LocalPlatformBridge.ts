import type { PlatformBridge, PlatformEnvironment } from "./PlatformBridge";

export class LocalPlatformBridge implements PlatformBridge {
  async initialize(): Promise<PlatformEnvironment> {
    await Promise.resolve();
    return {
      locale: navigator.language || "ru",
      platform: "local",
    };
  }

  gameplayStart(): void {
    document.documentElement.dataset.gameplay = "active";
  }

  gameplayStop(): void {
    document.documentElement.dataset.gameplay = "stopped";
  }
}
