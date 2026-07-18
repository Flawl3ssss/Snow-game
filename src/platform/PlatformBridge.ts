export type PlatformEnvironment = {
  locale: string;
  platform: "local" | "yandex";
};

export interface PlatformBridge {
  initialize(): Promise<PlatformEnvironment>;
  gameplayStart(): void;
  gameplayStop(): void;
}
