import { describe, expect, it } from "vitest";
import { birthLine, formatLongDate, formatMonthDay, formatMonthDayYear, initials, plural, untilLabel } from "../src/format";

describe("format", () => {
  it("formats calendar days without the browser's zone moving them", () => {
    expect(formatMonthDay("2026-10-14")).toBe("Oct 14");
    expect(formatMonthDayYear("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatLongDate("2026-09-05")).toBe("September 5, 2026");
  });

  it("shows the birth line like the iOS person screen, with age from the snapshot", () => {
    expect(birthLine("1987-10-07", false, 39)).toBe("Oct 7, 1987 - 39");
    expect(birthLine("0001-10-07", true, null)).toBe("Oct 7");
    expect(birthLine("1987-10-07", false, null)).toBe("Oct 7, 1987");
  });

  it("labels countdowns, initials and counts", () => {
    expect(untilLabel(0)).toBe("Today");
    expect(untilLabel(1)).toBe("In 1 day");
    expect(untilLabel(5)).toBe("In 5 days");
    expect(initials("  Riley  Jane Marlow ")).toBe("RJ");
    expect(plural(1, "member")).toBe("1 member");
    expect(plural(2, "person", "people")).toBe("2 people");
  });
});
