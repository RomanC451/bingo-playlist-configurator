import Link from "next/link";
import { Music2 } from "lucide-react";
import { loginAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-sm shadow-emerald-950/5 dark:shadow-none">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Music2 className="size-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Bingo Playlist Configurator
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to curate clips and run your next music bingo night.
          </p>
        </div>

        <form action={loginAction} className="space-y-4">
          {safeCallbackUrl && (
            <input type="hidden" name="callbackUrl" value={safeCallbackUrl} />
          )}
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="mt-2 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
