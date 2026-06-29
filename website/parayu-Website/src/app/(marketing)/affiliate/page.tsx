import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function AffiliatePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Partner Program</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Parayu Affiliate Program
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-8 leading-relaxed font-medium">
          Spread the word about offline dictation. Earn 30% recurring commission for every customer you refer to our desktop plans.
        </p>
        <button className="h-12 px-8 rounded-xl bg-[#e01e41] text-white font-semibold hover:bg-[#d81d54] transition-colors shadow-[0_8px_30px_rgba(224,30,65,0.18)] cursor-pointer">Join Now</button>
      </Section>
    </div>
  );
}
