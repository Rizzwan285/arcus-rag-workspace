"use client";

import { useSession, signOut } from "next-auth/react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  AlertTriangle,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const { data: stats } = trpc.document.getStats.useQuery(undefined, {
    enabled: !!session?.user,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-surface-900">
          Settings
        </h1>
        <p className="mt-1 text-surface-500">
          Manage your account and preferences
        </p>
      </div>

      {/* ── Profile Section ── */}
      <div className="card animate-fade-in animate-delay-1 overflow-hidden">
        <div className="border-b border-surface-200 bg-gradient-to-r from-arcus-50/50 to-purple-50/30 px-6 py-4">
          <h2 className="text-sm font-semibold text-surface-900">Profile</h2>
          <p className="text-xs text-surface-500">
            Your account information from OAuth provider
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-surface-100"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-arcus-500 to-purple-500 text-2xl font-bold text-white">
                {session?.user?.name?.[0] || "U"}
              </div>
            )}

            {/* Details */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
                  <User className="h-3 w-3" />
                  Full Name
                </label>
                <p className="mt-0.5 text-sm font-semibold text-surface-900">
                  {session?.user?.name || "Not set"}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
                  <Mail className="h-3 w-3" />
                  Email Address
                </label>
                <p className="mt-0.5 text-sm font-semibold text-surface-900">
                  {session?.user?.email || "Not set"}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
                  <Shield className="h-3 w-3" />
                  Auth Provider
                </label>
                <p className="mt-0.5 text-sm font-semibold text-surface-900">
                  OAuth (Google / GitHub)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Account Usage ── */}
      <div className="card animate-fade-in animate-delay-2 overflow-hidden">
        <div className="border-b border-surface-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-surface-900">Usage</h2>
          <p className="text-xs text-surface-500">
            Your current workspace activity
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-surface-100 sm:grid-cols-4">
          {[
            { label: "Documents", value: stats?.documentCount ?? 0 },
            { label: "Chat Sessions", value: stats?.chatSessionCount ?? 0 },
            { label: "Flashcard Decks", value: stats?.flashcardDeckCount ?? 0 },
            { label: "Quizzes", value: stats?.quizCount ?? 0 },
          ].map((item) => (
            <div key={item.label} className="bg-white p-5 text-center">
              <p className="text-2xl font-bold text-surface-900">{item.value}</p>
              <p className="mt-0.5 text-xs text-surface-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="card animate-fade-in animate-delay-3 overflow-hidden">
        <div className="border-b border-surface-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-surface-900">Resources</h2>
        </div>
        <div className="divide-y divide-surface-100">
          <a
            href="https://github.com/Rizzwan285/arcus-rag-workspace"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-4 text-sm text-surface-600 transition-colors hover:bg-surface-50"
          >
            <ExternalLink className="h-4 w-4 text-surface-400" />
            View Source on GitHub
          </a>
        </div>
      </div>

      {/* ── Sign Out ── */}
      <div className="card animate-fade-in animate-delay-4 overflow-hidden">
        <div className="border-b border-surface-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-surface-900">Session</h2>
        </div>
        <div className="p-6">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 rounded-xl border border-surface-200 px-5 py-2.5 text-sm font-medium text-surface-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="animate-fade-in animate-delay-5 overflow-hidden rounded-2xl border border-red-200">
        <div className="border-b border-red-200 bg-red-50/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h2>
          <p className="text-xs text-red-500">
            Irreversible and destructive actions
          </p>
        </div>
        <div className="bg-white p-6">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete My Account
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-surface-600">
                This will permanently delete your account and all associated
                data (documents, chats, flashcards, quizzes). Type{" "}
                <code className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                  DELETE
                </code>{" "}
                to confirm.
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  disabled={deleteText !== "DELETE"}
                  onClick={() => {
                    // In a real implementation, this would call a tRPC mutation
                    alert("Account deletion would be processed. For now, signing out.");
                    signOut({ callbackUrl: "/" });
                  }}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Permanently Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteText("");
                  }}
                  className="rounded-xl border border-surface-200 px-5 py-2.5 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
