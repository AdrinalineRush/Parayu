import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { PenTool, MessageSquare, Mic, List, Sparkles } from "lucide-react";

export default function ContentCreatorsUseCasePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-600 font-bold text-xs uppercase tracking-wider mb-6">
          <PenTool className="w-3.5 h-3.5" /> For Content Creators
        </div>
        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
          Overcome writer's block. <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600">Speak your first draft.</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          The blank page is intimidating. Speaking your ideas out loud isn't. Speak in Malayalam or your natural dialect, and let Parayu translate and write it in fluent English instantly.
        </p>

        <div className="max-w-4xl mx-auto w-full mb-32">
          {/* Simulated Creator Demo */}
          <div className="relative rounded-3xl bg-white border border-[#e8e5df] shadow-xl overflow-hidden max-w-3xl mx-auto text-left flex flex-col">
            <div className="h-12 border-b border-[#e8e5df] flex items-center px-4 gap-2 bg-[#f6f4f0]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="ml-4 text-sm text-[#706b61] font-medium font-serif flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#a02bb0]" /> blog_draft.txt
              </span>
            </div>
            <div className="p-8 font-serif text-lg text-zinc-700 leading-relaxed min-h-[250px]">
              <h2 className="text-2xl font-bold mb-4 text-[#1c1b19]">5 Ways to Overcome Creative Burnout</h2>
              <p className="mb-4">
                Creative burnout is something every writer faces. It's that feeling when you sit down at your desk, open your laptop, and the words just won't flow...
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 mt-4 rounded-full bg-fuchsia-500/10 text-fuchsia-600 text-sm border border-fuchsia-500/20 font-sans shadow-sm font-semibold">
                <Mic className="w-4 h-4 animate-pulse text-[#a02bb0]" /> "Make the intro punchier and add a hook."
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <BentoGrid className="max-w-5xl mx-auto">
          <BentoGridItem
            title="Brainstorming Ideas"
            description="Pace around your room, dictate your raw, unorganized thoughts, and let Parayu translate and structure them on the fly."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span>"Njan parayunnathu motham note aakkanam..." &rarr; "Keep track of all my notes..."</span>
              </div>
            }
            icon={<MessageSquare className="h-5 w-5 text-fuchsia-600" />}
            className="md:col-span-1"
          />
          <BentoGridItem
            title="Video Scripts"
            description="Speak your concepts out loud. Parayu formats them into structured script layouts directly inside Google Docs, Notion, or your scripting editor."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-zinc-600 shadow-inner font-medium">
                <span className="text-[#a02bb0] font-semibold">Intro:</span> Hey guys, welcome back to the channel. Today we are going to look at...
              </div>
            }
            icon={<List className="h-5 w-5 text-pink-600" />}
            className="md:col-span-2"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
