import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Latest News</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          The Parayu Blog
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 font-medium">
          News, product updates, and insights on local speech recognition and transcription technology.
        </p>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-4 group cursor-pointer bg-white border border-[#e8e5df] rounded-3xl p-6 hover:bg-[#f6f4f0] hover:border-[#e01e41]/30 hover:shadow-xl transition-all duration-300">
              <div className="aspect-[4/3] bg-[#f6f4f0] rounded-2xl border border-[#e8e5df] overflow-hidden">
                <div className="w-full h-full bg-[#f6f4f0] group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#e01e41]/50" />
                </div>
              </div>
              <div className="text-sm font-bold text-[#e01e41] mt-2">Product Update</div>
              <h3 className="text-xl font-bold text-[#1c1b19] group-hover:text-[#e01e41] transition-colors">Introducing Parayu Local Engine</h3>
              <p className="text-[#706b61] text-sm leading-relaxed font-medium">Today we are thrilled to announce the next generation of our offline voice engine running whisper.cpp locally...</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
