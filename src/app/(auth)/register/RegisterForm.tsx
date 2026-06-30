"use client";

import Link from "next/link";
import { useState } from "react";
import { registerAction } from "@/app/(auth)/actions";
import { AvatarPicker } from "@/components/AvatarPicker";

interface RegisterFormProps {
  errorMessage: string | null;
}

export function RegisterForm({ errorMessage }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!image) {
      e.preventDefault();
      setAvatarError(true);
    }
  }

  return (
    <form action={registerAction} onSubmit={handleSubmit} className="mt-8 space-y-4">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {avatarError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Please select an avatar before registering.
        </div>
      )}

      <AvatarPicker
        value={image}
        onChange={(url) => {
          setImage(url);
          setAvatarError(false);
        }}
        previewLabel={name.trim() || "?"}
      />
      <input type="hidden" name="image" value={image ?? ""} />

      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500">At least 8 characters</p>
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700"
      >
        Register
      </button>

      <p className="pt-2 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
