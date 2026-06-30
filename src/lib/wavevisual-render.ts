/** Tailwind zinc palette — matches the previous WaveformEditor bar colors. */
export const WAVEFORM_BAR_COLOR_LIGHT = "#a1a1aa"; // zinc-400
export const WAVEFORM_BAR_COLOR_DARK = "#52525b"; // zinc-600

/** Default WaveVisual editor settings for Spotify dotted-bar waveforms. */
export const WAVEVISUAL_RENDER_CONFIG = {
  thickness: 4,
  space: 1,
  dotMin: 4,
  refWidth: 720,
  refHeight: 360,
  nw: 512,
  mirrored: true,
} as const;

function getShownWaveformData(
  raw: number[],
  width: number,
  space: number,
  thickness: number,
): number[] {
  const step = space + Math.max(WAVEVISUAL_RENDER_CONFIG.dotMin, thickness);
  const samples: number[] = [];

  for (let x = 0; x < width; x += step) {
    const index = Math.floor((x / width) * raw.length);
    let minInWindow = raw[index] ?? WAVEVISUAL_RENDER_CONFIG.nw;

    for (let i = index; i < index + step; i++) {
      const value = raw[i];
      if (value != null && value < minInWindow) {
        minInWindow = value;
      }
    }

    const startValue = raw[index] ?? minInWindow;
    samples.push(Math.floor((minInWindow + startValue) / 2));
  }

  return samples;
}

function iterateRenderableSamples(
  shown: number[],
  width: number,
  sampleDistance: number,
  iterator: (sample: number, x: number) => void,
): void {
  for (let x = 0; x < width; x += sampleDistance) {
    const index = Math.floor((x * shown.length) / width);
    let minInWindow = shown[index] ?? WAVEVISUAL_RENDER_CONFIG.nw;

    for (let i = index; i < index + sampleDistance; i++) {
      const value = shown[i];
      if (value != null && value < minInWindow) {
        minInWindow = value;
      }
    }

    const startValue = shown[index] ?? minInWindow;
    iterator(Math.floor((minInWindow + startValue) / 2), x);
  }
}

function amplitudeToHeight(value: number, heightMultiplier = 1): number {
  const factor = Math.min(1, Math.max(0, 1 - value / WAVEVISUAL_RENDER_CONFIG.nw) * heightMultiplier);
  return Math.max(
    WAVEVISUAL_RENDER_CONFIG.dotMin,
    Math.floor(WAVEVISUAL_RENDER_CONFIG.refHeight * factor),
  );
}

/** Render WaveVisual-style dotted mirrored waveform SVG from raw API amplitudes. */
export function renderWaveVisualSvg(
  raw: number[],
  theme: "light" | "dark" = "light",
): string {
  const barColor =
    theme === "dark" ? WAVEFORM_BAR_COLOR_DARK : WAVEFORM_BAR_COLOR_LIGHT;
  const { space, thickness, refWidth, refHeight, mirrored, dotMin } =
    WAVEVISUAL_RENDER_CONFIG;
  const dotSize = Math.max(dotMin, thickness);
  const radius = dotSize / 2;
  const shown = getShownWaveformData(raw, refWidth, space, thickness);
  const sampleDistance = space + dotSize;
  const baselineRows = Math.max(1, Math.ceil(refHeight / 2 / dotSize));
  const totalSlots = mirrored
    ? baselineRows * 2
    : Math.max(1, Math.ceil(refHeight / dotSize));
  const center = refHeight / 2;
  const circles: string[] = [];

  iterateRenderableSamples(shown, refWidth, sampleDistance, (value, x) => {
    const barHeight = amplitudeToHeight(value);
    const activeDots = Math.floor(barHeight / dotSize);
    const cx = x + radius;

    for (let row = 0; row < totalSlots; row++) {
      let visible = false;
      let cy = center;

      if (mirrored) {
        if (row < baselineRows) {
          visible = activeDots > 0 && row < Math.ceil(activeDots / 2);
          cy = center - (row + 0.5) * dotSize;
        } else {
          visible = activeDots > 0 && row - baselineRows < Math.floor(activeDots / 2);
          cy = center + (row - baselineRows + 0.5) * dotSize;
        }
      } else {
        visible = row < activeDots;
        cy = center - (row + 0.5) * dotSize;
      }

      if (!visible) continue;
      circles.push(
        `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius}" fill="${barColor}"/>`,
      );
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${refWidth} ${refHeight}" preserveAspectRatio="none">
  ${circles.join("\n  ")}
</svg>`;
}

export function isRawWaveVisualAmplitudes(values: number[]): boolean {
  return values.length >= 500;
}

export function waveformImagePath(trackId: string, refresh = false): string {
  const params = new URLSearchParams();
  if (refresh) params.set("refresh", "1");
  const query = params.toString();
  return `/api/waveform/${encodeURIComponent(trackId)}/image${query ? `?${query}` : ""}`;
}
