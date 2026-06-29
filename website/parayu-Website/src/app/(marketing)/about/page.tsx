import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Our Mission</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          About Parayu
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          We believe typing is a bottleneck for human thought. Our mission is to build the ultimate local voice client that operates seamlessly, offline, and with 100% data sovereignty.
        </p>
        <div className="aspect-video bg-white rounded-3xl border border-[#e8e5df] max-w-4xl mx-auto flex flex-col items-center justify-center p-8 gap-3 shadow-lg">
          <Sparkles className="w-12 h-12 text-[#e01e41] opacity-75 animate-pulse" />
          <span className="text-[#706b61] font-semibold font-mono text-sm">Building the future of voice dictation offline</span>
        </div>
      </Section>
    </div>
  );
}
