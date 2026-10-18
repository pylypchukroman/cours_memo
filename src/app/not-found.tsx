import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The course may not exist, or you may not have access to it.</p>
      <Link href="/courses" className="mt-6 text-sm underline-offset-4 hover:underline">
        Back to courses
      </Link>
    </main>
  );
}
