import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/courses");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <main className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Course Memo</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Study materials grounded in your lessons</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Upload lesson transcripts and turn them into source-linked summaries, tasks, lab guides,
          assessment checklists, and revision materials.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/sign-in" className={cn(buttonVariants())}>
            Sign in
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ variant: "outline" }))}>
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
