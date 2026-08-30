import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  hasSupabasePublicEnv,
} from "@/lib/supabase/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

describe("supabase env helpers", () => {
  it("detects missing public env vars", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(hasSupabasePublicEnv()).toBe(false);
    expect(() => getSupabasePublicEnv()).toThrow(/Missing Supabase public environment variables/);
  });

  it("rejects placeholder values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon-key");

    expect(hasSupabasePublicEnv()).toBe(false);
  });

  it("returns configured public env vars", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

    expect(getSupabasePublicEnv()).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "test-anon-key",
    });
  });

  it("requires a real service role key for admin client usage", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key");

    expect(() => getSupabaseServiceRoleKey()).toThrow(/Missing SUPABASE_SERVICE_ROLE_KEY/);
  });
});
