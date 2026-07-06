const VOLUME_STORAGE_KEY = "clip-playback-volume";

let sharedVolume = 1;
let htmlAudioElement: HTMLAudioElement | null = null;

function readStoredVolume(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (stored == null) {
    return 1;
  }

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1, Math.max(0, parsed));
}

function persistVolume(volume: number) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
}

export function getSharedPlaybackVolume() {
  return sharedVolume;
}

export function registerHtmlAudioElement(element: HTMLAudioElement | null) {
  htmlAudioElement = element;
  if (element) {
    element.volume = sharedVolume;
  }
}

export function setSharedPlaybackVolume(volume: number) {
  const clamped = Math.min(1, Math.max(0, volume));
  sharedVolume = clamped;
  persistVolume(clamped);
  if (htmlAudioElement) {
    htmlAudioElement.volume = clamped;
  }
  return clamped;
}

sharedVolume = readStoredVolume();
