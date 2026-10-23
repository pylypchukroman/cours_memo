import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function loadEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const enabled =
  process.env.RUN_INTEGRATION === "1" &&
  url.startsWith("http") &&
  anonKey.length > 20 &&
  serviceKey.length > 20;

describe.skipIf(!enabled)("course membership isolation", () => {
  const admin = enabled
    ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : (null as unknown as SupabaseClient);
  const password = "course-memo-test-password";
  const stamp = Date.now();
  const emails = {
    owner: `owner-${stamp}@course-memo.test`,
    other: `other-${stamp}@course-memo.test`,
  };
  const userIds: string[] = [];
  let courseId = "";
  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;

  beforeAll(async () => {
    const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    if (!health.ok) {
      throw new Error("Local Supabase is not reachable");
    }

    for (const email of Object.values(emails)) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (!created.data.user) {
        throw created.error ?? new Error("Could not create test user");
      }
      userIds.push(created.data.user.id);
    }

    ownerClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    otherClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    await ownerClient.auth.signInWithPassword({ email: emails.owner, password });
    await otherClient.auth.signInWithPassword({ email: emails.other, password });

    const course = await ownerClient
      .from("courses")
      .insert({ title: "Ізоляція", created_by: userIds[0] })
      .select("id")
      .single();
    if (!course.data) {
      throw course.error ?? new Error("Could not create course");
    }
    courseId = course.data.id;
  });

  afterAll(async () => {
    if (!enabled) {
      return;
    }
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("hides a course from users who are not members", async () => {
    const owner = await ownerClient.from("courses").select("id").eq("id", courseId);
    const other = await otherClient.from("courses").select("id").eq("id", courseId);
    const anon = createClient(url, anonKey);

    expect(owner.data?.map((row) => row.id)).toEqual([courseId]);
    expect(other.data ?? []).toEqual([]);
    expect((await anon.from("courses").select("id")).data ?? []).toEqual([]);
  });

  it("returns transcript chunks only to course members", async () => {
    const source = await admin
      .from("source_files")
      .insert({
        course_id: courseId,
        uploaded_by: userIds[0],
        original_name: "lecture.vtt",
        lesson_title: "Derivatives",
        storage_path: `${courseId}/integration.vtt`,
        sha256: `sha-${stamp}`,
        byte_size: 128,
      })
      .select("id")
      .single();
    expect(source.error).toBeNull();

    const chunk = await admin
      .from("chunks")
      .insert({
        source_file_id: source.data?.id,
        course_id: courseId,
        ordinal: 0,
        text: "A derivative describes a rate of change.",
        start_ms: 1000,
        end_ms: 4000,
        token_count: 8,
      })
      .select("id")
      .single();
    expect(chunk.error).toBeNull();

    const match = await ownerClient.from("chunks").select("id").eq("id", chunk.data?.id);
    const hidden = await otherClient.from("chunks").select("id").eq("id", chunk.data?.id);

    expect(match.error).toBeNull();
    expect(match.data).toHaveLength(1);
    expect(hidden.data ?? []).toEqual([]);
  });

  it("stops upload calls after the fixed hourly limit", async () => {
    const results: boolean[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const { data } = await ownerClient.rpc("consume_rate_limit", { target_action: "upload" });
      results.push(data === true);
    }

    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results.at(-1)).toBe(false);
  });
});
