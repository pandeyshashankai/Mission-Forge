const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync(
  require("node:path").join(__dirname, "../src/interface.css"),
  "utf8",
);
const defaults = Object.fromEntries(
  [
    ...css
      .match(/:root\s*\{([^}]+)\}/)[1]
      .matchAll(/(--ui-[\w-]+):\s*(#[\da-f]{6})/gi),
  ].map((m) => [m[1], m[2]]),
);
const luminance = (hex) => {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
for (const theme of ["orbital", "nebula", "daylight"])
  test(`${theme} text and primary buttons meet 4.5:1 contrast`, () => {
    const block =
      theme === "orbital"
        ? ""
        : css.match(
            new RegExp(`html\\[data-theme=["']?${theme}["']?\\]\\s*\\{([^}]+)\\}`),
          )[1];
    const tokens = {
      ...defaults,
      ...Object.fromEntries(
        [...block.matchAll(/(--ui-[\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [
          m[1],
          m[2],
        ]),
      ),
    };
    for (const bg of ["--ui-bg", "--ui-panel", "--ui-input"])
      for (const fg of [
        "--ui-text",
        "--ui-muted",
        "--ui-subtle",
        "--ui-accent",
        "--ui-good",
        "--ui-danger",
        "--ui-warm",
      ])
        assert.ok(
          contrast(tokens[fg], tokens[bg]) >= 4.5,
          `${fg} on ${bg} is ${contrast(tokens[fg], tokens[bg]).toFixed(2)}:1`,
        );
    assert.ok(contrast("#ffffff", tokens["--ui-accent-strong"]) >= 4.5);
  });
