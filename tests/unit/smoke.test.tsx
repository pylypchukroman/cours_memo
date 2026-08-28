import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("tooling smoke test", () => {
  it("renders shadcn Button", () => {
    render(<Button>Тест</Button>);
    expect(screen.getByRole("button", { name: "Тест" })).toBeInTheDocument();
  });

  it("resolves path aliases", () => {
    expect(true).toBe(true);
  });
});
