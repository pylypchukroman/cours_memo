import { NextResponse } from "next/server";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";

type HealthResponse = {
  status: "ok" | "degraded" | "error";
  app: "course-memo";
  supabase: {
    configured: boolean;
    reachable: boolean;
    message?: string;
  };
};

async function checkSupabaseReachability(
  url: string,
  anonKey: string,
): Promise<{ reachable: boolean; message?: string }> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: {
        apikey: anonKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return {
        reachable: false,
        message: `Supabase health check returned ${response.status}`,
      };
    }

    return { reachable: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Supabase connection error";

    return {
      reachable: false,
      message,
    };
  }
}

export async function GET() {
  const payload: HealthResponse = {
    status: "error",
    app: "course-memo",
    supabase: {
      configured: hasSupabasePublicEnv(),
      reachable: false,
    },
  };

  if (!payload.supabase.configured) {
    payload.supabase.message =
      "Supabase env vars are missing. Copy .env.example to .env.local.";
    return NextResponse.json(payload, { status: 503 });
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const reachability = await checkSupabaseReachability(url, anonKey);

  payload.supabase.reachable = reachability.reachable;
  payload.supabase.message = reachability.message;

  if (!reachability.reachable) {
    payload.status = "degraded";
    return NextResponse.json(payload, { status: 503 });
  }

  payload.status = "ok";
  return NextResponse.json(payload);
}
