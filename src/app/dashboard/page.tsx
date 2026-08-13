import {
  FileText,
  MessageSquare,
  BookOpen,
  Brain,
  Upload,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Welcome Header ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-900">
          Welcome to Arcus
        </h1>
        <p className="mt-1 text-surface-500">
          Your AI-powered academic workspace. Upload documents and start
          learning.
        </p>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Documents",
            value: "0",
            icon: FileText,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Chat Sessions",
            value: "0",
            icon: MessageSquare,
            color: "text-arcus-600",
            bg: "bg-arcus-50",
          },
          {
            label: "Flashcard Decks",
            value: "0",
            icon: BookOpen,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Quizzes",
            value: "0",
            icon: Brain,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-surface-900">
                  {stat.value}
                </p>
              </div>
              <div className={`rounded-xl ${stat.bg} p-3`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-surface-900">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/documents"
            className="group flex items-center gap-4 rounded-2xl border border-dashed border-surface-300 bg-white p-6 transition-all hover:border-arcus-400 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-arcus-500 to-arcus-600 shadow-lg shadow-arcus-500/20">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">
                Upload Document
              </h3>
              <p className="text-sm text-surface-500">
                Add PDFs to your workspace
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-surface-300 transition-transform group-hover:translate-x-1 group-hover:text-arcus-500" />
          </Link>

          <Link
            href="/dashboard/chat"
            className="group flex items-center gap-4 rounded-2xl border border-dashed border-surface-300 bg-white p-6 transition-all hover:border-arcus-400 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">Start a Chat</h3>
              <p className="text-sm text-surface-500">
                Ask questions about your docs
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-surface-300 transition-transform group-hover:translate-x-1 group-hover:text-arcus-500" />
          </Link>

          <Link
            href="/dashboard/flashcards"
            className="group flex items-center gap-4 rounded-2xl border border-dashed border-surface-300 bg-white p-6 transition-all hover:border-arcus-400 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">
                Study Flashcards
              </h3>
              <p className="text-sm text-surface-500">
                Review auto-generated cards
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-surface-300 transition-transform group-hover:translate-x-1 group-hover:text-arcus-500" />
          </Link>
        </div>
      </div>

      {/* ── Getting Started Guide ── */}
      <div className="rounded-2xl border border-surface-200 bg-gradient-to-br from-arcus-50/50 to-purple-50/50 p-8">
        <h2 className="mb-2 text-lg font-semibold text-surface-900">
          🚀 Getting Started
        </h2>
        <p className="mb-6 text-sm text-surface-500">
          Follow these steps to set up your academic workspace
        </p>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: "Upload your course materials",
              desc: "PDFs of lecture notes, textbooks, or research papers",
              done: false,
            },
            {
              step: 2,
              title: "Wait for AI processing",
              desc: "Arcus will parse, chunk, and vectorize your documents",
              done: false,
            },
            {
              step: 3,
              title: "Start asking questions",
              desc: "Use the AI chat to query your documents with natural language",
              done: false,
            },
            {
              step: 4,
              title: "Generate study materials",
              desc: "Create flashcards and quizzes from your content",
              done: false,
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-4 rounded-xl bg-white/60 p-4"
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  item.done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-surface-100 text-surface-500"
                }`}
              >
                {item.step}
              </div>
              <div>
                <p className="font-medium text-surface-900">{item.title}</p>
                <p className="text-sm text-surface-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
