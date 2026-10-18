import Link from "next/link";

import { SignInForm } from "@/components/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/courses") ? params.next : "/courses";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <SignInForm nextPath={nextPath} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
