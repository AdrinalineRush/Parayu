"use client";

import { motion } from "framer-motion";
import { Section } from "@/components/shared/section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Shield,
  Keyboard,
  Cpu,
  Languages,
  BarChart3,
  Volume2,
  Command,
  WifiOff,
  Lock,
  Sparkles,
  Zap,
  MonitorSmartphone,
  BookOpen,
  FileText,
  Palette,
  Timer,
  Globe,
  Brain,
  Fingerprint,
  ChevronRight,
  ArrowRight,
  Check,
  Layers,
  Type,
  Settings,
  Clapperboard,
  MessageSquare,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const heroFeatures = [
  "100% Offline",
  "Zero Cloud Uploads",
  "System-Wide Paste",
  "AI Voice Commands",
  "Malayalam Native",
  "99+ Languages",
];

const spotlightFeatures = [
  {
    id: "whisper",
    badge: "Core Engine",
    title: "On-Device Whisper AI",
    subtitle: "Four speech brains. One local machine.",
    description:
      "Parayu runs OpenAI's Whisper models directly on your CPU or Apple Silicon GPU via whisper.cpp — no internet, no cloud, no latency. Pick the brain that fits your hardware.",
    icon: Brain,
    color: "#e01e41",
    models: [
      { name: "LOW", size: "190 MB", params: "0.07B", speed: "Fastest" },
      { name: "MEDIUM", size: "539 MB", params: "0.24B", speed: "Balanced" },
      { name: "HIGH", size: "844 MB", params: "1.55B", speed: "5-bit Quantized" },
      { name: "PRO", size: "2.9 GB", params: "1.55B", speed: "Full 16-bit" },
    ],
  },
  {
    id: "privacy",
    badge: "Privacy First",
    title: "Your Voice Never Leaves Your Device",
    subtitle: "No screen capture. No cloud. No compromises.",
    description:
      "Audio is processed in volatile RAM and deleted immediately after transcription. Parayu never captures your screen, never phones home, and works perfectly without WiFi.",
    icon: Shield,
    color: "#10b981",
    bullets: [
      "Audio deleted after transcription",
      "Zero screen or window capturing",
      "No API keys or cloud calls",
      "Encrypted token storage (OS Keychain)",
      "Works on airplane mode",
    ],
  },
  {
    id: "paste",
    badge: "System Integration",
    title: "Dictate Anywhere. Paste Everywhere.",
    subtitle: "One hotkey. Every app on your desktop.",
    description:
      "Press ⌥ Space (or your custom hotkey) to start dictating. When you stop, Parayu types the clean text directly at your cursor — in Slack, VS Code, Notion, Gmail, Terminal, or any app.",
    icon: Keyboard,
    color: "#8b5cf6",
    apps: ["Slack", "VS Code", "Notion", "Gmail", "Chrome", "Terminal", "Trello", "Any App"],
  },
];

const featureGrid = [
  {
    icon: Command,
    title: "AI Voice Commands",
    description: "Say 'format as email', 'summarize', or 'make it a list' — Parayu reshapes your dictation with offline AI prompt templates.",
    tag: "Pro",
  },
  {
    icon: Languages,
    title: "Malayalam → English",
    description: "Dictate in spoken Malayalam or English slang. Parayu translates and maps colloquial words to clean English using curated dictionaries.",
    tag: "Pro",
  },
  {
    icon: BookOpen,
    title: "Personal Dictionary",
    description: "Add 'misheard → correct' word pairs. Parayu auto-replaces them every time, learning your vocabulary over time.",
    tag: "Pro",
  },
  {
    icon: FileText,
    title: "Text Snippets",
    description: "Define trigger phrases that expand into full paragraphs, signatures, or boilerplate — spoken shortcuts for repetitive text.",
    tag: "Pro",
  },
  {
    icon: Sparkles,
    title: "AI Cleanup & Formatting",
    description: "Removes filler words (um, uh), fixes punctuation, capitalizes sentences, and detects self-corrections — all rule-based and instant.",
  },
  {
    icon: Palette,
    title: "AI Tone Styling",
    description: "Adjust your output tone: Natural, Professional, Casual, Developer Prompt, or Short Reply. The local LLM adapts your words.",
    tag: "Pro",
  },
  {
    icon: Clapperboard,
    title: "Pro Screenplay Editor",
    description: "A full screenwriting tool with scene headings, character blocks, dialogue formatting, autocomplete, .fountain export, and PDF print.",
    tag: "Pro",
  },
  {
    icon: Globe,
    title: "Live Multi-Language Translation",
    description: "Dictate in one language and see real-time translations in English, Malayalam, Tamil, Kannada, and Hindi — all processed locally.",
    tag: "Pro",
  },
  {
    icon: Volume2,
    title: "Audio Hardware Tuning",
    description: "Select your microphone, test levels on a 16-bar VU meter, toggle auto-gain, noise suppression, and echo cancellation.",
  },
  {
    icon: BarChart3,
    title: "Insights Dashboard",
    description: "Track total words, WPM speed gauge, contribution heatmap streaks, app-usage charts, and smart editing stats — all in one view.",
  },
  {
    icon: Timer,
    title: "Two Dictation Modes",
    description: "Toggle mode (tap to start/stop) or Push-to-Talk (hold key to speak, release to paste). Custom hotkey recording included.",
  },
  {
    icon: Layers,
    title: "Clipboard Preservation",
    description: "Parayu saves and restores your clipboard around every paste so your copied content is never lost.",
  },
  {
    icon: Zap,
    title: "Apple Silicon GPU Acceleration",
    description: "Automatically uses Metal GPU on M1/M2/M3/M4 Macs for blazing-fast transcription. Falls back to CPU gracefully on Intel.",
  },
  {
    icon: Type,
    title: "Smart vs Fast Cleanup",
    description: "Smart mode uses rule-based + local LLM cleanup. Fast mode skips the LLM for instant results on short dictations.",
  },
  {
    icon: Fingerprint,
    title: "Hallucination-Safe Output",
    description: "The local LLM is configured to preserve names, numbers, dates, and links — never generating or hallucinating content.",
    tag: "Pro",
  },
  {
    icon: MonitorSmartphone,
    title: "macOS, Windows & iOS",
    description: "Full native support on macOS (Apple Silicon & Intel) and Windows 10/11. iOS app in active development.",
  },
];

const stats = [
  { value: "99+", label: "Languages Supported" },
  { value: "0", label: "Cloud Uploads" },
  { value: "4", label: "AI Speech Brains" },
  { value: "<3s", label: "Avg. Transcription" },
];

/* ------------------------------------------------------------------ */
/*  Reusable Components                                                */
/* ------------------------------------------------------------------ */

function FeatureTag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#e01e41]/10 text-[#e01e41] text-[10px] font-black uppercase tracking-wider">
      {children}
    </span>
  );
}

function AnimatedCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FeaturesPage() {
  return (
    <div className="flex flex-col bg-white text-[#1c1b19] min-h-screen">
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <Section className="pt-32 pb-20 text-center relative overflow-hidden" size="lg">
        {/* Subtle radial glow */}
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[#e01e41]/[0.04] blur-[130px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#e01e41]/[0.06] border border-[#e01e41]/10 text-[#e01e41] text-xs font-black uppercase tracking-wider mb-6"
          >
            <Mic className="w-3.5 h-3.5" />
            Every Feature. On Your Device.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-[1.08] mb-6"
          >
            Voice to Text.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e01e41] via-[#c2185b] to-[#7c5cff]">
              No Internet Required.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-[#706b61] max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Parayu runs OpenAI Whisper models locally on your machine. Dictate
            in any language, paste into any app, and keep every word private —
            all without an internet connection.
          </motion.p>

          {/* Hero pill tags */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-2.5 mb-10"
          >
            {heroFeatures.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f6f4f0] border border-[#e8e5df] text-xs font-bold text-[#1c1b19]"
              >
                <Check className="w-3 h-3 text-emerald-500" />
                {f}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-[#e01e41] hover:bg-[#c21835] text-white rounded-2xl shadow-lg shadow-[#e01e41]/10 px-8 py-6 text-base font-bold"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-[#e8e5df] rounded-2xl px-8 py-6 text-base font-bold"
              >
                View Pricing
              </Button>
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  STATS BAR                                                   */}
      {/* ============================================================ */}
      <div className="border-y border-[#e8e5df] bg-[#faf9f7]">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <AnimatedCard key={i} delay={i * 0.08}>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-heading font-black text-[#1c1b19]">
                  {s.value}
                </div>
                <div className="text-xs font-bold text-[#706b61] uppercase tracking-wider mt-1">
                  {s.label}
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  SPOTLIGHT FEATURES (3 large sections)                       */}
      {/* ============================================================ */}
      <Section className="py-24" size="lg">
        <div className="max-w-6xl mx-auto px-4 space-y-32">
          {/* --- Spotlight 1: Whisper AI Engine --- */}
          {(() => {
            const s = spotlightFeatures[0];
            return (
              <AnimatedCard>
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20` }}>
                      <s.icon className="w-3.5 h-3.5" />
                      {s.badge}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tight mb-3 leading-[1.15]">
                      {s.title}
                    </h2>
                    <p className="text-lg font-bold text-[#706b61] mb-4">{s.subtitle}</p>
                    <p className="text-sm text-[#706b61] leading-relaxed font-medium mb-8">
                      {s.description}
                    </p>
                    <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#e01e41] hover:underline">
                      Compare plans <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  {/* Model Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {s.models!.map((m, i) => (
                      <motion.div
                        key={m.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="rounded-2xl border border-[#e8e5df] bg-[#faf9f7] p-5 hover:shadow-lg hover:border-[#e01e41]/20 transition-all duration-300 group"
                      >
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#e01e41] mb-2">
                          {m.name}
                        </div>
                        <div className="text-xl font-heading font-black text-[#1c1b19] mb-1">
                          {m.params}
                        </div>
                        <div className="text-[11px] text-[#706b61] font-semibold">
                          {m.size} · {m.speed}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </AnimatedCard>
            );
          })()}

          {/* --- Spotlight 2: Privacy --- */}
          {(() => {
            const s = spotlightFeatures[1];
            return (
              <AnimatedCard>
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  {/* Privacy visual */}
                  <div className="order-2 md:order-1 rounded-3xl border border-[#e8e5df] bg-[#faf9f7] p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/[0.04] blur-[80px] rounded-full pointer-events-none" />
                    <div className="space-y-4 relative z-10">
                      {s.bullets!.map((b, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.35, delay: i * 0.06 }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          </div>
                          <span className="text-sm font-bold text-[#1c1b19]">{b}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="order-1 md:order-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20` }}>
                      <s.icon className="w-3.5 h-3.5" />
                      {s.badge}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tight mb-3 leading-[1.15]">
                      {s.title}
                    </h2>
                    <p className="text-lg font-bold text-[#706b61] mb-4">{s.subtitle}</p>
                    <p className="text-sm text-[#706b61] leading-relaxed font-medium mb-8">
                      {s.description}
                    </p>
                    <Link href="/parayu-vs-wispr-flow" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:underline">
                      See privacy comparison <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </AnimatedCard>
            );
          })()}

          {/* --- Spotlight 3: System-Wide Paste --- */}
          {(() => {
            const s = spotlightFeatures[2];
            return (
              <AnimatedCard>
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20` }}>
                      <s.icon className="w-3.5 h-3.5" />
                      {s.badge}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tight mb-3 leading-[1.15]">
                      {s.title}
                    </h2>
                    <p className="text-lg font-bold text-[#706b61] mb-4">{s.subtitle}</p>
                    <p className="text-sm text-[#706b61] leading-relaxed font-medium mb-8">
                      {s.description}
                    </p>

                    {/* Hotkey visual */}
                    <div className="flex items-center gap-2.5 mb-8">
                      <kbd className="px-4 py-2 rounded-xl bg-[#f6f4f0] border border-[#e8e5df] text-[#1c1b19] font-mono text-sm shadow-sm font-bold">
                        ⌥ Option
                      </kbd>
                      <span className="text-[#706b61] font-black text-sm">+</span>
                      <kbd className="px-6 py-2 rounded-xl bg-[#f6f4f0] border border-[#e8e5df] text-[#1c1b19] font-mono text-sm shadow-sm font-bold">
                        Space
                      </kbd>
                    </div>
                  </div>
                  {/* App grid */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {s.apps!.map((app, i) => (
                      <motion.div
                        key={app}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="flex items-center justify-center rounded-2xl border border-[#e8e5df] bg-[#faf9f7] py-4 px-2 hover:shadow-md hover:border-[#7c5cff]/30 transition-all duration-300"
                      >
                        <span className="text-xs font-bold text-[#1c1b19] text-center">{app}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </AnimatedCard>
            );
          })()}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  FEATURE GRID (16 cards)                                     */}
      {/* ============================================================ */}
      <Section className="py-24 bg-[#faf9f7] border-y border-[#e8e5df]" size="lg">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <AnimatedCard>
              <h2 className="text-3xl md:text-5xl font-heading font-black tracking-tight mb-4">
                Everything You Need.{" "}
                <span className="text-[#e01e41]">Nothing You Don&apos;t.</span>
              </h2>
              <p className="text-[#706b61] font-medium text-lg max-w-2xl mx-auto">
                A comprehensive suite of dictation, formatting, and productivity
                tools — all running locally on your machine.
              </p>
            </AnimatedCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureGrid.map((f, i) => {
              const Icon = f.icon;
              return (
                <AnimatedCard key={i} delay={i * 0.03}>
                  <div className="group rounded-2xl bg-white border border-[#e8e5df] p-6 h-full hover:shadow-xl hover:border-[#e01e41]/15 transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#f6f4f0] border border-[#e8e5df] flex items-center justify-center text-[#1c1b19] group-hover:bg-[#e01e41]/[0.06] group-hover:text-[#e01e41] group-hover:border-[#e01e41]/15 transition-all duration-300">
                        <Icon className="w-5 h-5" />
                      </div>
                      {f.tag && <FeatureTag>{f.tag}</FeatureTag>}
                    </div>
                    <h3 className="font-heading font-black text-[#1c1b19] text-sm mb-2 leading-tight">
                      {f.title}
                    </h3>
                    <p className="text-xs text-[#706b61] font-medium leading-relaxed flex-1">
                      {f.description}
                    </p>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  CTA BANNER                                                  */}
      {/* ============================================================ */}
      <Section className="py-24" size="md">
        <AnimatedCard>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tight mb-4">
              Ready to dictate{" "}
              <span className="text-[#e01e41]">offline</span>?
            </h2>
            <p className="text-[#706b61] font-medium text-lg mb-8 max-w-xl mx-auto">
              Start with 2,500 free words every week. No credit card, no cloud
              account, no strings attached.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="bg-[#e01e41] hover:bg-[#c21835] text-white rounded-2xl shadow-lg shadow-[#e01e41]/10 px-8 py-6 text-base font-bold"
                >
                  Download Parayu
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/parayu-vs-wispr-flow">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#e8e5df] rounded-2xl px-8 py-6 text-base font-bold"
                >
                  Compare with Wispr Flow
                </Button>
              </Link>
            </div>
          </div>
        </AnimatedCard>
      </Section>
    </div>
  );
}
