import { Section } from "@/components/shared/section";
import { Sparkles, HelpCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Support Desk</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Help Center
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
          How can we help you today?
        </p>
        <div className="max-w-xl mx-auto relative">
          <input type="text" placeholder="Search support articles..." className="w-full p-4 pl-6 rounded-full border border-[#e8e5df] bg-white focus:border-[#e01e41] outline-none text-[#1c1b19] placeholder-[#706b61]/60 shadow-lg transition-colors text-lg" />
        </div>
      </Section>
    </div>
  );
}
