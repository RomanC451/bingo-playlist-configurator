"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { errorMessageFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ProfilePageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { TutorialWelcomeBanner } from "@/components/tutorial/TutorialWelcomeBanner";

interface Profile {
  name: string | null;
  email: string;
  image: string | null;
  hasPassword: boolean;
}

export default function ProfilePage() {
  const { update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    begin();
    try {
      const res = await fetch("/api/profile");
      const data = await readJsonResponse<Profile & { error?: string }>(res);
      if (!res.ok) {
        setError(data.error ?? "Failed to load profile");
        setProfile(null);
      } else {
        setProfile(data);
        setName(data.name ?? "");
        setEmail(data.email);
        setImage(data.image);
        setError(null);
      }
      setInitialized(true);
    } catch {
      setError("Failed to load profile");
      setProfile(null);
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload: Record<string, string> = {};
    if (name.trim() !== (profile?.name ?? "")) {
      payload.name = name.trim();
    }
    if (email.trim() !== profile?.email) {
      payload.email = email.trim();
    }
    if ((image ?? null) !== (profile?.image ?? null) && image) {
      payload.image = image;
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse<Profile & { error?: string }>(res);

      if (!res.ok) {
        setSaveError(errorMessageFromBody(data, "Failed to save profile"));
        setSaving(false);
        return;
      }

      setProfile(data);
      setName(data.name ?? "");
      setEmail(data.email);
      setImage(data.image);
      setSaved(true);
      setPasswordSaved(false);
      await update({
        name: data.name ?? undefined,
        email: data.email,
        image: data.image,
      });
    } catch {
      setSaveError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (!initialized) {
    if (loading) return <ProfilePageSkeleton />;
    return null;
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error ?? "Profile not found"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <TutorialWelcomeBanner tutorialId="profile" />

      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Your display name appears on saved clip versions and team activity.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}
        {saved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Profile saved.
          </div>
        )}
        {passwordSaved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Password updated.
          </div>
        )}

        <div data-tutorial="profile-avatar">
        <AvatarPicker
          value={image}
          onChange={setImage}
          previewLabel={name.trim() || email || "?"}
        />
        </div>

        <div data-tutorial="profile-details">
        <div>
          <label className="block text-sm font-medium" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
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
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        </div>

        {profile.hasPassword && (
          <button
            type="button"
            data-tutorial="profile-password"
            onClick={() => {
              setPasswordSaved(false);
              setPasswordDialogOpen(true);
            }}
            className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
          >
            Change password
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onSuccess={() => {
          setSaved(false);
          setPasswordSaved(true);
        }}
      />
    </div>
  );
}
