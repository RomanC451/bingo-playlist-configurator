import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid email or password",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, callbackUrl } = await searchParams;
  const safeCallbackUrl =
    callbackUrl?.startsWith("/") ? callbackUrl : undefined;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Sign in failed" : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Host music bingo with custom clip ranges. For Spotify Connect, sign in at{" "}
        <a href="http://127.0.0.1:3000/login" className="text-emerald-600 hover:underline">
          http://127.0.0.1:3000
        </a>{" "}
        (not localhost) and connect from team settings.
      </p>

      <form action={loginAction} className="mt-8 space-y-4">
        {safeCallbackUrl && (
          <input type="hidden" name="callbackUrl" value={safeCallbackUrl} />
        )}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/register" className="text-emerald-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
