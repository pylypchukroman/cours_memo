const PLACEHOLDER_VALUES = new Set([
  "your-anon-key",
  "your-service-role-key",
  "https://your-project.supabase.co",
]);

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim());
}

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

export type SupabaseServerEnv = SupabasePublicEnv & {
  serviceRoleKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
    throw new Error(
      "Missing Supabase public environment variables. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

export function getSupabaseServiceRoleKey(): string {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey || isPlaceholder(serviceRoleKey)) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and set the service role key.",
    );
  }

  return serviceRoleKey;
}

export function getSupabaseServerEnv(): SupabaseServerEnv {
  return {
    ...getSupabasePublicEnv(),
    serviceRoleKey: getSupabaseServiceRoleKey(),
  };
}

export function hasSupabasePublicEnv(): boolean {
  try {
    getSupabasePublicEnv();
    return true;
  } catch {
    return false;
  }
}
