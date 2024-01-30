import {
  bold,
  white,
  bgRed,
  bgYellow,
  black,
  bgGreen,
  bgMagenta,
  bgCyan,
} from "picocolors";

export const ERR = bold(white(bgRed("[ERR]")));
export const WRN = bold(black(bgYellow("[WRN]")));
export const INF = bold(black(bgGreen("[INF]")));
export const DBG = bold(white(bgMagenta("[DBG]")));
export const TRC = bold(black(bgCyan("[TRC]")));
