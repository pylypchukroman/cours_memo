export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-zinc-950">
      <main className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Course Memo
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI-помічник з пам&apos;яттю курсу
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Завантажуйте транскрипти уроків, накопичуйте знання курсу та
          отримуйте відповіді лише з ваших матеріалів — з точними посиланнями на
          урок і таймкод.
        </p>
        <p className="mt-8 text-sm text-zinc-500">
          Проєкт ініціалізовано. Наступний крок — tooling і Supabase.
        </p>
      </main>
    </div>
  );
}
