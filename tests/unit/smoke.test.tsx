import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("tooling smoke test", () => {
  it("renders shadcn Button", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button", { name: "Test" })).toBeInTheDocument();
  });
});
