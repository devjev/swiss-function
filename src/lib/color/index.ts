// Hand-rolled colour engine: conversions across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab,
// sRGB gamut mapping, CSS parse/serialize, and channel-track gradients. Powers
// `ColorPicker`; usable on its own.

export { inSpectralLocus, SPECTRAL_LOCUS, SRGB_PRIMARIES, SRGB_WHITE, xyOf } from "./chromaticity";
export {
  channelsToSrgb,
  clamp01,
  convert,
  hexToSrgb,
  type Srgb,
  srgbToChannels,
  srgbToHex,
  srgbToXy,
  srgbToXyz,
  type Vec3,
  xyToDisplaySrgb,
  xyzToSrgb,
} from "./convert";
export { type ColorFormat, type CssSpace, type ParsedColor, parse, toCss } from "./format";
export {
  channelsInGamut,
  clampToSrgb,
  clipSrgb,
  srgbInGamut,
} from "./gamut";
export { alphaGradient, channelGradient } from "./gradient";
export {
  type ChannelDef,
  hueIndex,
  SPACE_IDS,
  SPACES,
  type SpaceDef,
  type SpaceId,
} from "./spaces";
