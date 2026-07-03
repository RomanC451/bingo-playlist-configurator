declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface WebPlaybackState {
    paused: boolean;
    position: number;
    track_window: {
      current_track: {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
      } | null;
    };
  }

  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: "ready", cb: (data: { device_id: string }) => void): void;
    addListener(event: "not_ready", cb: (data: { device_id: string }) => void): void;
    addListener(
      event: "player_state_changed",
      cb: (state: WebPlaybackState | null) => void,
    ): void;
    addListener(event: "initialization_error", cb: (data: { message: string }) => void): void;
    addListener(event: "authentication_error", cb: (data: { message: string }) => void): void;
    addListener(event: "account_error", cb: (data: { message: string }) => void): void;
    removeListener(
      event:
        | "ready"
        | "not_ready"
        | "player_state_changed"
        | "initialization_error"
        | "authentication_error"
        | "account_error",
      cb?: (...args: unknown[]) => void,
    ): void;
    getCurrentState(): Promise<WebPlaybackState | null>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    activateElement(): Promise<void>;
  }

  interface PlayerConstructor {
    new (options: PlayerInit): Player;
  }
}

interface Window {
  Spotify?: {
    Player: Spotify.PlayerConstructor;
  };
  onSpotifyWebPlaybackSDKReady?: () => void;
}