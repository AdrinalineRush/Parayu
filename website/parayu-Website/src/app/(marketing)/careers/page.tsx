import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function CareersPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>We're Hiring</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Join our team
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto leading-relaxed font-medium">
          Help us build the future of offline voice technology. We are fully remote and hiring globally.
        </p>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <div className="max-w-3xl mx-auto space-y-4">
          {[
            "Senior Desktop Engineer (C++ / Electron)",
            "Machine Learning Engineer (Speech Recognition / Whisper.cpp)",
            "Product Designer",
            "Developer Advocate"
          ].map((role, i) => (
            <div key={i} className="flex items-center justify-between p-6 rounded-2xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] hover:border-[#e01e41]/30 hover:shadow-xl transition-all cursor-pointer">
              <div>
                <h3 className="text-lg font-bold text-[#1c1b19]">{role}</h3>
                <p className="text-[#706b61] text-sm mt-1 font-medium">Remote • Full-time</p>
              </div>
              <div className="text-[#e01e41] font-bold text-sm">Apply &rarr;</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
