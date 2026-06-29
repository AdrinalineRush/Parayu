import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { 
  Mic, 
  Command, 
  Languages, 
  Sparkles, 
  Shield, 
  Keyboard, 
  Cpu, 
  BarChart3, 
  Volume2, 
  Settings 
} from "lucide-react";

export default function FeaturesPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen">
      {/* Hero Section */}
      <Section className="pt-32 pb-16 text-center relative overflow-hidden" size="lg">
        {/* Glow background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-heading font-extrabold text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
            Unmatched Privacy.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e81f3a] via-[#d81d54] to-[#a02bb0]">
              Desktop Voice Control.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#706b61] max-w-2xl mx-auto mb-8 leading-relaxed font-medium">
            Parayu's voice engine integrates directly into your operating system to let you dictate, translate, and format text hands-free in any desktop application.
          </p>
        </div>
      </Section>

      {/* Bento Grid Features */}
      <Section className="pb-32 border-t border-[#e8e5df] bg-background" size="lg">
        <div className="text-center mb-16 max-w-xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-4">Desktop Capabilities</h2>
          <p className="text-[#706b61] font-medium">A comprehensive suite of dictation tools built for macOS and Windows.</p>
        </div>

        <BentoGrid className="max-w-6xl mx-auto px-4">
          <BentoGridItem
            title="Local whisper.cpp Engine"
            description="Run OpenAI's high-accuracy Whisper models directly on your CPU/GPU. Choose from Tiny (75MB), Base (140MB), Small (460MB), or Medium (1.5GB) depending on your hardware limits."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-gradient-to-br from-[#e01e41]/5 to-zinc-50 border border-[#e8e5df] p-4 flex-col justify-between shadow-inner">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] font-semibold">Tiny (75MB)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] font-semibold">Base (140MB)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] font-semibold">Small (460MB)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold">Medium (1.5GB)</span>
                </div>
                <div className="text-[11px] text-[#706b61] font-mono flex justify-between font-medium">
                  <span>whisper.cpp engine</span>
                  <span>CPU/GPU Native</span>
                </div>
              </div>
            }
            icon={<Cpu className="h-5 w-5" />}
            className="md:col-span-2"
          />
          
          <BentoGridItem
            title="System-Wide Hotkey Paste"
            description="Press Option + Space to dictate anywhere. parayu-Website types the transcribed text directly at your cursor's focus point."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 items-center justify-center gap-2 shadow-inner">
                <kbd className="px-3 py-1.5 rounded-lg bg-white border border-[#e8e5df] text-[#1c1b19] font-mono text-sm shadow-sm font-semibold">⌥ Option</kbd>
                <span className="text-zinc-400 text-sm font-bold">+</span>
                <kbd className="px-5 py-1.5 rounded-lg bg-white border border-[#e8e5df] text-[#1c1b19] font-mono text-sm shadow-sm font-semibold">Space</kbd>
              </div>
            }
            icon={<Keyboard className="h-5 w-5" />}
            className="md:col-span-1"
          />

          <BentoGridItem
            title="AI Voice Commands"
            description="Say commands like 'make it a list', 'write an email', or 'summarize' to automatically shape your thoughts via prompt templates."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 flex-col justify-center gap-2 shadow-inner">
                <div className="text-xs bg-white p-2.5 rounded-lg border border-[#e8e5df] text-zinc-700 flex items-center justify-between shadow-sm">
                  <span>"Format as email..."</span>
                  <span className="text-[#e01e41] font-bold text-[10px] uppercase">Active</span>
                </div>
              </div>
            }
            icon={<Command className="h-5 w-5" />}
            className="md:col-span-1"
          />

          <BentoGridItem
            title="Malayalam & Custom Dictionary"
            description="Dictate in Malayalam or English slang. Parayu maps colloquial words to standard English using the curated global dictionary."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 flex-col justify-center gap-2 font-mono text-xs text-zinc-500 shadow-inner">
                <div className="flex justify-between border-b border-[#e8e5df] pb-1">
                  <span className="text-zinc-600">"sugamano"</span>
                  <span className="text-[#e01e41] font-semibold">"how are you?"</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e5df] pb-1">
                  <span className="text-zinc-600">"innale"</span>
                  <span className="text-[#e01e41] font-semibold">"yesterday"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">"cinema"</span>
                  <span className="text-[#e01e41] font-semibold">"movie"</span>
                </div>
              </div>
            }
            icon={<Languages className="h-5 w-5" />}
            className="md:col-span-2"
          />

          <BentoGridItem
            title="Metrics & Insights Dashboard"
            description="Track your dictation statistics, including hours saved, total words generated, speech velocity (words/minute), heatmap calendar streaks, and dictionary corrections."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 flex-col justify-between shadow-inner">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-2xl font-bold text-[#1c1b19]">4.8 hrs</span>
                    <p className="text-[10px] text-[#706b61] font-medium">Total time saved</p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-600 text-xs font-bold">+18% this week</span>
                  </div>
                </div>
                <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-[#e8e5df]">
                  <div className="bg-[#e01e41] h-full rounded-full" style={{ width: "65%" }}></div>
                </div>
              </div>
            }
            icon={<BarChart3 className="h-5 w-5" />}
            className="md:col-span-2"
          />

          <BentoGridItem
            title="Audio Hardware Tuning"
            description="Choose your microphone input, test audio signal levels on VU meters, and enable premium noise cleanup controls."
            header={
              <div className="flex flex-1 w-full min-h-[6rem] rounded-2xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 flex-col justify-center gap-1.5 shadow-inner">
                <div className="flex gap-[3px] items-center h-6 justify-center">
                  {[4, 10, 15, 8, 12, 19, 5, 14, 9, 3].map((h, i) => (
                    <div key={i} className="w-1 bg-[#e01e41] rounded-full" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <span className="text-[10px] text-center text-[#706b61] font-mono font-medium">Microphone Level Test</span>
              </div>
            }
            icon={<Volume2 className="h-5 w-5" />}
            className="md:col-span-1"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
