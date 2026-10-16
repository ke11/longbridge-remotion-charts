import React from "react";
import { TYPE } from "./theme";

type Item = {
  key: string;
  label: string;
  color: string;
  /** Sets the segment's width, relative to the other items. */
  value: number;
  /** Printed after the label: a share, an amount. */
  text: string;
};

const GAP = 4;
const LABEL_GAP = 28;

/**
 * A bar split in proportion to `value`, with one label per segment.
 *
 * Each label starts under its own segment where there is room. A segment
 * too narrow for its label does not lose it: labels are pushed apart left to
 * right, then pulled back in from the right edge, so a 5% sliver at the end
 * of the bar is still named.
 */
export const SplitBar: React.FC<{
  items: Item[];
  width: number;
  textColor: string;
}> = ({ items, width, textColor }) => {
  const total = items.reduce((sum, it) => sum + it.value, 0) || 1;
  // Geist Mono is fixed-pitch, so a label's width follows from its length.
  const widths = items.map(
    (it) => it.label.length * 13.2 + (it.text.length + 1) * 12,
  );

  const lefts: number[] = [];
  let run = 0;
  items.forEach((it, i) => {
    const min = i ? lefts[i - 1] + widths[i - 1] + LABEL_GAP : 0;
    lefts.push(Math.max(run, min));
    run += (it.value / total) * width;
  });
  for (let i = items.length - 1, limit = width; i >= 0; i--) {
    lefts[i] = Math.max(0, Math.min(lefts[i], limit - widths[i]));
    limit = lefts[i] - LABEL_GAP;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: GAP,
          height: 14,
          borderRadius: 7,
          overflow: "hidden",
        }}
      >
        {items.map((it) => (
          <div
            key={it.key}
            style={{ flexGrow: it.value, flexBasis: 0, background: it.color }}
          />
        ))}
      </div>
      <div style={{ position: "relative", height: 28, marginTop: 12 }}>
        {items.map((it, i) => (
          <div
            key={it.key}
            style={{
              position: "absolute",
              left: lefts[i],
              whiteSpace: "nowrap",
              ...TYPE.share,
              color: textColor,
            }}
          >
            <span style={{ ...TYPE.ticker, fontSize: 20, color: it.color }}>
              {it.label}
            </span>{" "}
            {it.text}
          </div>
        ))}
      </div>
    </>
  );
};
