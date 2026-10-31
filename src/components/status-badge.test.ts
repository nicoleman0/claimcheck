import { expect, test } from "bun:test";

import { toneFor } from "./status-badge";

test("toneFor maps known statuses and falls back to neutral", () => {
  const tones = { approved: "success", rejected: "danger" } as const;
  expect(toneFor("approved", tones)).toBe("success");
  expect(toneFor("unknown", tones)).toBe("neutral");
});
