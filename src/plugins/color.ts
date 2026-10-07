// Small hex colour helpers for deriving theme v2's tinted surfaces and the
// app bar's gradient partner from a single per-app accent.

type Rgb = [number, number, number];

const parseHex = (hex: string): Rgb => {
  let digits = hex.trim().replace(/^#/, "");
  if (digits.length === 3) digits = digits.replaceAll(/./g, (char) => char + char);
  if (!/^[0-9a-f]{6}$/i.test(digits)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16)) as Rgb;
};

const toHex = (rgb: Rgb): string =>
  "#" +
  rgb
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

// `weight` of `a` blended into `b` (0 = pure b, 1 = pure a).
export const mix = (colorA: string, colorB: string, weight: number): string => {
  const from = parseHex(colorA);
  const into = parseHex(colorB);
  return toHex(from.map((channel, index) => channel * weight + into[index] * (1 - weight)) as Rgb);
};

const rgbToHsl = ([red255, green255, blue255]: Rgb): Rgb => {
  const red = red255 / 255;
  const green = green255 / 255;
  const blue = blue255 / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [hue * 60, saturation, lightness];
};

const hslToRgb = ([hue, saturation, lightness]: Rgb): Rgb => {
  const wheelPosition = (offset: number) => (offset + hue / 30) % 12;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) =>
    lightness -
    chroma *
      Math.max(-1, Math.min(wheelPosition(offset) - 3, Math.min(9 - wheelPosition(offset), 1)));
  return [channel(0) * 255, channel(8) * 255, channel(4) * 255];
};

// Rotates the hue by `degrees` and nudges lightness by `lightness` (-1..1),
// keeping saturation - a neighbouring colour that still reads as the same app.
export const shiftHue = (hex: string, degrees: number, lightness = 0): string => {
  const [hue, saturation, baseLightness] = rgbToHsl(parseHex(hex));
  return toHex(
    hslToRgb([
      (((hue + degrees) % 360) + 360) % 360,
      saturation,
      Math.min(1, Math.max(0, baseLightness + lightness)),
    ]),
  );
};
