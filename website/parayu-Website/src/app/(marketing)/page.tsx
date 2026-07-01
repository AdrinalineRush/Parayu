"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Apple, 
  Monitor, 
  Shield, 
  Sparkles, 
  Keyboard, 
  Languages, 
  Wand2, 
  FileText, 
  BookOpen, 
  Clock, 
  Pencil, 
  Flame, 
  Terminal, 
  Check, 
  ArrowRight, 
  Mic, 
  Cpu, 
  ChevronDown, 
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/section";
import { InteractiveVoiceDemo } from "@/components/marketing/interactive-voice-demo";
import { AnimatePresence, motion } from "framer-motion";
import { LaunchSoonButton } from "@/components/marketing/launch-soon-button";

export default function HomePage() {

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Does Parayu send my voice recordings or keystrokes to any servers?",
      a: "No. Parayu is built to run 100% locally on your machine. The speech model processes audio entirely on your device's CPU/GPU. There are no API keys, no network calls for transcription, and no tracking of what you speak or write."
    },
    {
      q: "How does the Malayalam translation system work?",
      a: "Malayalam is one of India's major languages. Parayu uses a lightweight local translation dictionary to convert spoken Malayalam into standard, natural English sentences instantly."
    },
    {
      q: "How does the system-wide paste hotkey work?",
      a: "Press ⌥Space (Mac) or Alt+Space (Windows) to trigger the tool. Talk at your normal pace. The moment you release the keys, the local model translates your speech and emulates native keyboard presses to type the final text directly into whichever app has cursor focus."
    },
    {
      q: "What are the computer specs required to run Parayu?",
      a: "Parayu is highly optimized. It runs natively on macOS (Apple Silicon M1/M2/M3/M4 or Intel Core processors running Big Sur or newer) and Windows 10/11. The local Whisper model files compile via C++ execution (whisper.cpp) for low memory footprint under 200MB."
    },
    {
      q: "What is the difference between the Free and Pro plans?",
      a: "The Base Plan is completely free and allows standard local English speech-to-text. The Pro Plan unlocks Malayalam-to-English translation, advanced AI Tone styling options, unlimited custom abbreviations, dictionary synchronization, and deep desktop analytics. Pro is available as a monthly subscription or a high-value Lifetime License."
    }
  ];

  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen selection:bg-primary/20 selection:text-primary">
      
      {/* Hero Section */}
      <Section className="pt-24 pb-12 text-center relative overflow-hidden" size="lg">
        {/* Sleek warm gradients */}
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-primary/4 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-[15%] right-[-15%] w-[450px] h-[450px] bg-[#a855f7]/3 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[25%] left-[-15%] w-[450px] h-[450px] bg-[#ff5d42]/3 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-5xl mx-auto px-4">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border shadow-sm text-xs font-bold tracking-wide text-primary">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span>Runs 100% locally on your computer</span>
            <span className="text-muted-foreground font-normal border-l border-border pl-2">v1.2.0</span>
          </div>

          {/* Squircle Premium Icon */}
          <div className="relative group my-2 select-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary/80 to-[#a855f7] rounded-[40px] blur-[30px] opacity-15 group-hover:opacity-25 transition-opacity duration-500 w-[124px] h-[124px] mx-auto" />
            <div className="relative w-28 h-28 mx-auto rounded-[32px] bg-card border border-border p-4.5 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1.5px_0_rgba(255,255,255,0.1)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1.5px_0_rgba(255,255,255,0.05)] flex items-center justify-center transition-all duration-500 hover:scale-105 hover:rotate-[2deg] hover:border-primary/35">
              <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain filter drop-shadow-[0_6px_12px_rgba(224,30,65,0.12)]" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black tracking-tight max-w-4xl leading-[1.05] text-foreground">
            Speak naturally.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e01e41] via-[#d81d54] to-[#a02bb0] dark:from-[#a78bfa] dark:via-[#c084fc] dark:to-[#e879f9]">
              Paste clean English anywhere.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-semibold">
            Powered by a custom-made on-device AI engine, Parayu translates spoken Malayalam or English slang to clean, polished English text—with 100% offline security. Download natively for macOS and Windows. iOS and Android apps are in active development.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <LaunchSoonButton className="h-14 px-8 text-base rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_30px_rgba(224,30,65,0.15)] transition-all duration-300 cursor-pointer font-bold inline-flex items-center justify-center gap-2">
              <span>Download Client (Free)</span>
              <ArrowRight className="w-4 h-4" />
            </LaunchSoonButton>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border text-foreground hover:bg-secondary bg-transparent cursor-pointer font-bold">
                View Pricing Tiers
              </Button>
            </Link>
          </div>

          {/* Supported Specs */}
          <div className="flex flex-wrap justify-center items-center gap-6 pt-4 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><Apple className="w-4 h-4" /> macOS 10.15+ (Apple Silicon & Intel)</span>
            <span className="flex items-center gap-1.5"><Monitor className="w-4 h-4" /> Windows 10 / 11</span>
            <span className="flex items-center gap-1.5 text-primary">✓ No servers, runs fully offline</span>
          </div>
        </div>
      </Section>

      {/* Product Walkthrough Section */}
      <Section className="py-16 relative bg-card border-y border-border overflow-visible" size="lg">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <span className="text-primary font-bold text-xs uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">On-Device Workflow</span>
          <h2 className="text-3xl md:text-5xl font-heading font-black mt-3 text-foreground">
            How Parayu works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base font-semibold mt-2">
            Sits in your menu bar. Triggers in two seconds. Clean offline speech translation.
          </p>
        </div>
        
        {/* The active app keystroke simulator */}
        <InteractiveVoiceDemo />

        {/* Small security annotation under mockup */}
        <div className="text-center mt-8 text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
          <Shield className="w-4.5 h-4.5 text-[#0d9488]" />
          <span>All translations occur on your local hardware. Audio files never leave your computer.</span>
        </div>
      </Section>

      {/* Product Features Section */}
      <Section className="py-20 relative bg-background" size="lg">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="text-primary font-bold text-xs uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">Features</span>
          <h2 className="text-3xl md:text-5xl font-heading font-black mt-3 text-foreground">Built for speed and absolute privacy</h2>
          <p className="text-muted-foreground font-semibold mt-2">A simple dictation helper with everything you need to type naturally.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
          
          {/* Feature 1 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Runs completely on-device</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Processes sound clips using localized Whisper models on your CPU or GPU. Audio files are deleted immediately after transcription and never touch the cloud.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-emerald-600 uppercase mt-4">Offline Data Safety</div>
          </div>

          {/* Feature 2 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-[#a855f7] dark:text-[#c084fc] border border-purple-500/20 flex items-center justify-center mb-4">
                <Languages className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Translates Malayalam</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Offline translation dictionaries understand Malayalam phrases and convert them to standard, fluent English sentences automatically.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-[#a855f7] uppercase mt-4">Local Malayalam Dictionary</div>
          </div>

          {/* Feature 3 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-4">
                <Keyboard className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Dictate anywhere</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Hold a customizable hotkey shortcut, speak, and release. Parayu automatically emulates native keyboard presses to paste your text block directly at your active cursor.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-primary uppercase mt-4">Universal App Support</div>
          </div>

          {/* Feature 4 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4">
                <Wand2 className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Local formatting options</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Adjust writing tone to Casual or Professional, clean up grammar, or summarize transcripts instantly using lightweight offline helper models.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-blue-600 uppercase mt-4">On-Device LLM formatting</div>
          </div>

          {/* Feature 5 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Voice expansion shortcuts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Define shorthand voice commands to instantly insert long email signatures, project boilerplates, templates, or markdown pages in seconds.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-pink-600 uppercase mt-4">Text expansion macro</div>
          </div>

          {/* Feature 6 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Learns your vocabulary</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Add specialized names, custom abbreviations, slang, or technical keywords to your personal offline dictionary to ensure perfect transcription results.
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 text-[10px] font-bold text-amber-600 uppercase mt-4">Custom Dictionary</div>
          </div>

        </div>
      </Section>

      {/* How it works - Step Workflow */}
      <Section className="py-20 bg-secondary border-t border-border relative overflow-hidden" size="lg">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/3 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-[#0d9488] font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">Workflow</span>
            <h2 className="text-3xl md:text-5xl font-heading font-black mt-3 text-foreground">
              How it works
            </h2>
            <p className="text-muted-foreground font-semibold mt-2">Sits in your menu bar. Triggers in two seconds.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col gap-3.5 relative">
              <div className="w-10 h-10 rounded-full bg-card border border-border text-primary flex items-center justify-center font-black text-sm shadow-sm">
                1
              </div>
              <h3 className="font-heading font-bold text-base text-foreground">Press ⌥ + Space</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Parayu listens via background keyboard hooks. A clean, floating audio wave overlay appears near your cursor to indicate active recording.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col gap-3.5 relative">
              <div className="w-10 h-10 rounded-full bg-card border border-border text-primary flex items-center justify-center font-black text-sm shadow-sm">
                2
              </div>
              <h3 className="font-heading font-bold text-base text-foreground">Speak (English / Malayalam)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Talk at your normal speed. The offline C++ transcription engine translates slang and fixes grammar on your CPU or GPU in milliseconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-3.5 relative">
              <div className="w-10 h-10 rounded-full bg-card border border-border text-primary flex items-center justify-center font-black text-sm shadow-sm">
                3
              </div>
              <h3 className="font-heading font-bold text-base text-foreground">Release to type</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                Release the hotkey shortcut. Parayu instantly emulates native keyboard keystrokes to type your formatted transcription directly into whichever app has focus.
              </p>
            </div>

          </div>
        </div>
      </Section>



      {/* FAQs Section */}
      <Section className="py-20 bg-secondary border-t border-border relative" size="lg">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-muted-foreground font-bold text-xs uppercase tracking-widest bg-card border border-border px-3 py-1 rounded-full">FAQ</span>
            <h2 className="text-3xl md:text-5xl font-heading font-black mt-3 text-foreground">
              Common Queries
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-card border border-border rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  <button 
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-sm md:text-base text-foreground cursor-pointer hover:bg-primary/5 transition-all select-none"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180 text-primary" : ""}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-border/50"
                      >
                        <p className="px-6 py-5 text-xs md:text-sm text-muted-foreground leading-relaxed font-semibold bg-background">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Premium Footer CTA Section */}
      <Section className="py-24 relative overflow-hidden bg-card border-t border-border" size="lg">
        <div className="absolute inset-0 bg-secondary/50 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-t from-primary/5 via-purple-500/3 to-transparent blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 text-center flex flex-col items-center max-w-3xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-heading font-black text-foreground mb-4 tracking-tight leading-[1.1]">
            Start typing with your voice today
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-10 max-w-xl leading-relaxed font-semibold">
            Join developers, designers, and bilingual professionals who dictate 3x faster than writing. Start using Parayu for free.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <LaunchSoonButton className="h-14 px-8 text-base rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-[0_8px_30px_rgba(224,30,65,0.15)] transition-all cursor-pointer font-bold inline-flex items-center justify-center gap-2">
              <span>Download Client (Free)</span>
              <ArrowRight className="w-4 h-4" />
            </LaunchSoonButton>
            <Link href="/sign-up?plan=pro_lifetime">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border text-foreground hover:bg-secondary bg-transparent cursor-pointer font-bold">
                Get Lifetime License
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
