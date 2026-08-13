import Link from "next/link";
import {
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Zap,
  Calendar,
  GraduationCap,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="gradient-bg grid-pattern min-h-screen text-white">
      {/* ── Navigation ── */}
      <nav className="glass fixed top-0 right-0 left-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-arcus-500 to-arcus-700 font-bold text-white shadow-lg">
                A
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-950 bg-emerald-400"></div>
            </div>
            <span className="text-xl font-bold tracking-tight">Arcus</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-surface-400 transition-colors hover:text-white"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-surface-400 transition-colors hover:text-white"
            >
              How It Works
            </a>
            <a
              href="#tech"
              className="text-sm text-surface-400 transition-colors hover:text-white"
            >
              Technology
            </a>
          </div>
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-full bg-arcus-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-arcus-500 hover:shadow-lg hover:shadow-arcus-600/25"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
        {/* Decorative Orbs */}
        <div className="animate-float absolute top-32 left-20 h-72 w-72 rounded-full bg-arcus-500/10 blur-3xl"></div>
        <div className="animate-float-delayed absolute right-20 bottom-32 h-96 w-96 rounded-full bg-purple-500/8 blur-3xl"></div>
        <div className="animate-float-slow absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl"></div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          {/* Badge */}
          <div className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-arcus-400" />
            <span className="text-surface-300">
              AI-Powered Academic Workspace
            </span>
          </div>

          {/* Headline */}
          <h1 className="glow-text mb-6 text-5xl leading-tight font-extrabold tracking-tight md:text-7xl lg:text-8xl">
            Your Study Materials,{" "}
            <span className="bg-gradient-to-r from-arcus-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Supercharged
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-surface-400 md:text-xl">
            Upload your course documents and let Arcus transform them into an
            interactive learning experience — with AI chat, auto-generated
            flashcards, quizzes, and smart scheduling.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-arcus-600/20 transition-all hover:-translate-y-0.5 hover:shadow-arcus-600/30"
            >
              Start Learning
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="glass flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-semibold text-surface-300 transition-all hover:-translate-y-0.5 hover:text-white"
            >
              Explore Features
            </a>
          </div>

          {/* Stats */}
          <div className="glass mt-20 inline-flex divide-x divide-white/10 rounded-2xl">
            {[
              { label: "Documents Processed", value: "∞" },
              { label: "Study Modes", value: "4+" },
              { label: "AI-Powered", value: "100%" },
            ].map((stat) => (
              <div key={stat.label} className="px-8 py-5">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-surface-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="relative px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-arcus-400 uppercase">
              Features
            </p>
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-arcus-400 to-purple-400 bg-clip-text text-transparent">
                Excel
              </span>
            </h2>
            <p className="mx-auto max-w-xl text-surface-400">
              Arcus combines cutting-edge AI with intuitive design to
              revolutionize how you study and retain knowledge.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Smart Document Upload",
                description:
                  "Upload PDFs and let our AI parse, chunk, and vectorize your content for instant semantic search.",
                gradient: "from-blue-500/20 to-cyan-500/20",
                iconColor: "text-blue-400",
              },
              {
                icon: MessageSquare,
                title: "RAG-Powered Chat",
                description:
                  "Ask questions about your documents and get accurate, context-aware answers with source citations.",
                gradient: "from-arcus-500/20 to-purple-500/20",
                iconColor: "text-arcus-400",
              },
              {
                icon: BookOpen,
                title: "Auto Flashcards",
                description:
                  "Generate flashcard decks from your materials with one click. Study smarter with spaced repetition.",
                gradient: "from-emerald-500/20 to-teal-500/20",
                iconColor: "text-emerald-400",
              },
              {
                icon: Brain,
                title: "Quiz Generation",
                description:
                  "AI creates multiple-choice quizzes from your content to test your understanding and identify gaps.",
                gradient: "from-amber-500/20 to-orange-500/20",
                iconColor: "text-amber-400",
              },
              {
                icon: Calendar,
                title: "Study Planner",
                description:
                  "Extract dates and deadlines from syllabi. Auto-populate your Google Calendar with study schedules.",
                gradient: "from-rose-500/20 to-pink-500/20",
                iconColor: "text-rose-400",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description:
                  "Built on pgvector for blazing-fast semantic search. Get answers in milliseconds, not seconds.",
                gradient: "from-yellow-500/20 to-amber-500/20",
                iconColor: "text-yellow-400",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass group cursor-pointer rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:border-white/15"
              >
                <div
                  className={`mb-5 inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-3`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-surface-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-20 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-arcus-400 uppercase">
              How It Works
            </p>
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              Three Steps to{" "}
              <span className="bg-gradient-to-r from-arcus-400 to-blue-400 bg-clip-text text-transparent">
                Smarter Learning
              </span>
            </h2>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Upload Your Documents",
                description:
                  "Drop your PDFs — lecture notes, textbooks, research papers. Arcus parses and understands them instantly.",
                icon: Layers,
              },
              {
                step: "02",
                title: "Ask Anything",
                description:
                  "Chat with your documents using natural language. Get precise answers with references to the exact page and section.",
                icon: MessageSquare,
              },
              {
                step: "03",
                title: "Study & Review",
                description:
                  "Generate flashcards and quizzes from your materials. Schedule study sessions that sync to your calendar.",
                icon: GraduationCap,
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="glass flex items-start gap-8 rounded-2xl p-8 transition-all hover:border-white/15"
              >
                <div className="flex-shrink-0">
                  <span className="text-5xl font-black text-arcus-500/30">
                    {item.step}
                  </span>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-arcus-400" />
                    <h3 className="text-xl font-bold text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="leading-relaxed text-surface-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section id="tech" className="relative px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-arcus-400 uppercase">
              Technology
            </p>
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              Built With the{" "}
              <span className="bg-gradient-to-r from-arcus-400 to-emerald-400 bg-clip-text text-transparent">
                Best Stack
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { name: "Next.js", desc: "React Framework" },
              { name: "tRPC", desc: "Type-Safe APIs" },
              { name: "Prisma", desc: "Database ORM" },
              { name: "pgvector", desc: "Vector Search" },
              { name: "LangChain", desc: "AI Pipeline" },
              { name: "Tailwind", desc: "Styling" },
              { name: "PostgreSQL", desc: "Database" },
              { name: "TypeScript", desc: "Type Safety" },
            ].map((tech) => (
              <div
                key={tech.name}
                className="glass rounded-xl p-5 text-center transition-all hover:-translate-y-0.5 hover:border-white/15"
              >
                <p className="font-semibold text-white">{tech.name}</p>
                <p className="mt-1 text-xs text-surface-500">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative px-6 py-32">
        <div className="glow-purple mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-arcus-600/20 to-purple-600/20 p-16 text-center">
          <Sparkles className="mx-auto mb-6 h-10 w-10 text-arcus-400" />
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Ready to Transform Your Study Sessions?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-surface-400">
            Join the future of academic learning. Upload your first document and
            experience the power of AI-assisted study.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-10 py-4 text-lg font-semibold text-white shadow-2xl shadow-arcus-600/20 transition-all hover:-translate-y-0.5 hover:shadow-arcus-600/30"
          >
            Launch Arcus
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-arcus-500 to-arcus-700 text-sm font-bold text-white">
              A
            </div>
            <span className="font-semibold">Arcus</span>
          </div>
          <p className="text-sm text-surface-500">
            © 2026 Arcus. Built with ❤️ for learners.
          </p>
        </div>
      </footer>
    </div>
  );
}
