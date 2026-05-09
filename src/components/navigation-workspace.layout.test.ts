import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile-first app layout", () => {
  it("defines a 390x844-safe mobile shell with fixed bottom navigation", () => {
    const css = readFileSync(
      new URL("./navigation-workspace.module.css", import.meta.url),
      "utf8",
    );

    expect(css).toContain("@media (max-width: 430px)");
    expect(css).toMatch(/\.phone\s*\{[\s\S]*width:\s*min\(100%,\s*430px\)/);
    expect(css).toMatch(/\.phone\s*\{[\s\S]*min-height:\s*844px/);
    expect(css).toMatch(/\.bottomNav\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.actionGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  });
});
