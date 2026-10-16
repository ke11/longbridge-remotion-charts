/**
 * Frames at 60fps. The window is whatever `startDate` says, so the travel — and with it the whole duration — is derived from the
 * number of trading days rather than fixed.
 */
const INTRO = {
  TITLE_IN: 0,
  COUNTER_IN: 12,
  GRID_IN: 26,
  GRID_LEN: 24,
  CARDS_IN: 38,
  CARD_STAGGER: 7,
  TRAVEL_START: 84,
} as const;

const ZOOM_OUT_LEN = 100;
const MARKERS_DELAY = 24;
const HOLD = 170;

/**
 * Frames each point gets when the pace is automatic. A month is one point
 * standing in for ~21 sessions, so it holds the screen longer than a day.
 */
const FRAMES_PER_POINT = { day: 5, month: 24 } as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function portfolioTimeline(
  days: number,
  fps: number,
  durationSeconds = 0,
  interval: keyof typeof FRAMES_PER_POINT = "day",
) {
  const fixed = INTRO.TRAVEL_START + ZOOM_OUT_LEN + HOLD;
  const travel =
    durationSeconds > 0
      ? Math.max(120, Math.round(durationSeconds * fps) - fixed)
      : clamp(days * FRAMES_PER_POINT[interval], 420, 1500);
  const TRAVEL_END = INTRO.TRAVEL_START + travel;
  return {
    ...INTRO,
    TRAVEL_END,
    ZOOM_OUT_START: TRAVEL_END,
    ZOOM_OUT_LEN,
    MARKERS_IN: TRAVEL_END + ZOOM_OUT_LEN + MARKERS_DELAY,
    DURATION: TRAVEL_END + ZOOM_OUT_LEN + HOLD,
  };
}

/**
 * Points (days or months) on screen while zoomed in. A fifth of the series keeps the
 * zoom meaningful on a three-month window and stops a five-year one from
 * crushing each session into a pixel.
 */
export const windowDays = (days: number) =>
  Math.min(days - 1, clamp(Math.round(days / 5), 12, 40));
