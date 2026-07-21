// Hand-rolled colour engine: conversions across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab,
// sRGB gamut mapping, CSS parse/serialize, and channel-track gradients. Powers
// `ColorPicker`; usable on its own.

export {
  channelsToSrgb,
  clamp01,
  convert,
  hexToSrgb,
  type Srgb,
  srgbToChannels,
  srgbToHex,
  type Vec3,
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
