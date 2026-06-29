import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { GitMerge, BookOpen, FileText, Sparkles } from "lucide-react";

export default function StudentsUseCasePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 font-bold text-xs uppercase tracking-wider mb-6">
          <GitMerge className="w-3.5 h-3.5" /> For Students & Academics
        </div>
        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
          Ace your studies. <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600">Boost your efficiency.</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Draft essays, write seminar papers, and dictate study outlines completely offline. Keep your focus sharp and your battery usage low.
        </p>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <BentoGrid className="max-w-5xl mx-auto">
          <BentoGridItem
            title="Study Outlines"
            description="Speak your thoughts and let Parayu format them into structured summaries, right inside your local word processor."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span className="text-amber-700 font-bold">Chapter 1 Summary:</span><br/>
                <span>- Introduction to local inference engines.</span>
              </div>
            }
            icon={<BookOpen className="h-5 w-5 text-amber-600" />}
            className="md:col-span-2"
          />
          <BentoGridItem
            title="Essay Outlining"
            description="Dictate thesis ideas and sections without having to type. Parayu parses your voice instantly to standard text."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span>"Thesis: local voice models are faster than API clients..."</span>
              </div>
            }
            icon={<FileText className="h-5 w-5 text-amber-600" />}
            className="md:col-span-1"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
