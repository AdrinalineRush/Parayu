import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { Terminal, Users, TrendingUp, Sparkles } from "lucide-react";

export default function FoundersUseCasePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 font-bold text-xs uppercase tracking-wider mb-6">
          <Terminal className="w-3.5 h-3.5" /> For Founders & Execs
        </div>
        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
          Delegate your <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-[#a02bb0]">busywork.</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Your time is the most valuable asset in your company. Stop typing endless emails and status reports. Just speak, and watch Parayu paste formatted text instantly into your active window.
        </p>

        <div className="max-w-4xl mx-auto w-full mb-32">
          {/* Simulated Exec Demo */}
          <div className="relative rounded-3xl bg-white border border-[#e8e5df] shadow-xl overflow-hidden max-w-3xl mx-auto text-left">
            <div className="h-12 border-b border-[#e8e5df] flex items-center px-4 gap-2 bg-[#f6f4f0] justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="text-xs font-semibold text-[#706b61]">Compose Email</div>
              <div className="w-16"></div>
            </div>
            <div className="p-8">
              <div className="border-b border-[#e8e5df] pb-2 mb-4 text-sm text-[#706b61] flex gap-4 font-medium">
                <span className="font-semibold text-zinc-500">To:</span> investors@seedfund.vc
              </div>
              <div className="border-b border-[#e8e5df] pb-2 mb-6 text-sm text-[#706b61] flex gap-4 font-medium">
                <span className="font-semibold text-zinc-500">Subject:</span> October Startup Update - MoM Growth!
              </div>
              <div className="text-zinc-800 leading-relaxed font-sans min-h-[150px] font-medium">
                <p className="mb-4">Hi everyone,</p>
                <p className="mb-4">I'm thrilled to share our October update. We hit our MRR targets two weeks early, driven entirely by the new enterprise feature launch...</p>
                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 mt-2 rounded-lg bg-blue-500/10 text-blue-600 text-xs border border-blue-500/20 font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> "Add bullet points for the 3 key hires we made."
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <BentoGrid className="max-w-5xl mx-auto">
          <BentoGridItem
            title="Investor & Team Updates"
            description="Speak your weekly wins and goals. Parayu structures them into bullet points in Slack, Teams, or email."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span className="text-blue-600 font-bold">Key Wins:</span><br/>
                <span>- Closed 3 enterprise pilots.<br/>- Released local whisper app updates.</span>
              </div>
            }
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
            className="md:col-span-2"
          />
          <BentoGridItem
            title="Quick Feedback"
            description="Dictate empathetic, clear feedback to team members hands-free without getting bogged down in formatting."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span>"Great job on the design, let's polish the spacing..."</span>
              </div>
            }
            icon={<Users className="h-5 w-5 text-indigo-600" />}
            className="md:col-span-1"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
