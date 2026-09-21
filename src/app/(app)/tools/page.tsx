"use client";

import Link from "next/link";
import { FileSpreadsheet, Gift } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

const tools = [
  {
    href: "/tools/cheat-sheet",
    title: "Cheat sheet",
    description:
      "Upload a bingo-cards PDF or generate one from a Spotify playlist, then calculate a fresh host cheat sheet.",
    icon: FileSpreadsheet,
  },
  {
    href: "/tools/giveaway",
    title: "Giveaway",
    description:
      "Import a comments CSV and pick a winner with a draw animation.",
    icon: Gift,
  },
];

export default function ToolsPage() {
  return (
    <div>
      <Breadcrumb className="mb-4" items={[{ label: "Tools" }]} />
      <h1 className="text-2xl font-semibold">Tools</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Extra helpers for bingo night. These do not create a session.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="flex h-full gap-4 rounded-xl border border-zinc-200 bg-white p-5 hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-medium">{tool.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{tool.description}</p>
              </div>
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
