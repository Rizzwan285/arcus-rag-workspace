"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { ExternalLink, LogOut, Trash2, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Field,
  Metric,
  Panel,
  PanelHeader,
  PageHeader,
} from "@/components/ui";
import { formatNumber } from "@/lib/utils";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: stats } = trpc.document.getStats.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const deleteAccount = trpc.account.deleteAccount.useMutation({
    onSuccess: () => signOut({ callbackUrl: "/" }),
    onError: (error) => setDeleteError(error.message),
  });

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, workspace usage, and account controls."
      />

      {/* ── Profile ── */}
      <Panel>
        <PanelHeader
          title="Profile"
          description="Provided by your OAuth provider — not editable here"
        />
        <div className="flex items-start gap-5 p-4">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-100 font-mono text-lg font-semibold text-surface-500">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}

          <dl className="min-w-0 flex-1 divide-y divide-line">
            <Field label="Name" mono={false}>
              {session?.user?.name ?? "Not set"}
            </Field>
            <Field label="Email">{session?.user?.email ?? "Not set"}</Field>
            <Field label="Provider" mono={false}>
              OAuth · Google or GitHub
            </Field>
          </dl>
        </div>
      </Panel>

      {/* ── Usage ── */}
      <Panel>
        <PanelHeader
          title="Usage"
          description="What this account currently holds"
        />
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3">
          <div className="p-4">
            <Metric label="Documents" value={stats?.documentCount ?? 0} />
          </div>
          <div className="p-4">
            <Metric
              label="Chunks"
              value={formatNumber(stats?.chunkCount ?? 0)}
            />
          </div>
          <div className="p-4">
            <Metric label="Chats" value={stats?.chatSessionCount ?? 0} />
          </div>
          <div className="p-4">
            <Metric label="Decks" value={stats?.flashcardDeckCount ?? 0} />
          </div>
          <div className="p-4">
            <Metric label="Quizzes" value={stats?.quizCount ?? 0} />
          </div>
          <div className="p-4">
            <Metric
              label="Failed"
              value={stats?.failedCount ?? 0}
              tone={(stats?.failedCount ?? 0) > 0 ? "err" : "idle"}
            />
          </div>
        </div>
      </Panel>

      {/* ── Resources ── */}
      <Panel>
        <PanelHeader title="Resources" />
        <a
          href="https://github.com/Rizzwan285/arcus-rag-workspace"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-4 py-3 text-sm text-surface-600 transition-colors hover:bg-surface-50 hover:text-surface-900"
        >
          <ExternalLink className="h-3.5 w-3.5 text-surface-400" />
          View source on GitHub
        </a>
      </Panel>

      {/* ── Session ── */}
      <Panel>
        <PanelHeader title="Session" />
        <div className="p-4">
          <Button onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </Panel>

      {/* ── Danger zone ── */}
      <Panel className="border-red-200">
        <div className="border-b border-red-200 bg-err-soft px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-err">
            <TriangleAlert className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <p className="mt-0.5 text-xs text-surface-500">
            Deleting your account is immediate and cannot be undone.
          </p>
        </div>

        <div className="p-4">
          {!confirmingDelete ? (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete my account
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-surface-600">
                This permanently removes your account and everything attached to
                it — {stats?.documentCount ?? 0} document
                {stats?.documentCount === 1 ? "" : "s"},{" "}
                {formatNumber(stats?.chunkCount ?? 0)} indexed chunks, all chat
                history, study modules, and calendar events. Type{" "}
                <code className="rounded border border-red-200 bg-err-soft px-1.5 py-0.5 font-mono text-2xs text-err">
                  DELETE
                </code>{" "}
                to confirm.
              </p>

              <input
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setDeleteError(null);
                }}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
                className="w-full max-w-xs rounded-md border border-line bg-surface-0 px-3 py-2 font-mono text-sm text-surface-900 placeholder:text-surface-300 focus:border-err focus:outline-none"
              />

              {deleteError && (
                <p className="text-xs text-err">{deleteError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={confirmation !== "DELETE"}
                  loading={deleteAccount.isPending}
                  onClick={() =>
                    deleteAccount.mutate({ confirmation: "DELETE" })
                  }
                >
                  Permanently delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setConfirmation("");
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
