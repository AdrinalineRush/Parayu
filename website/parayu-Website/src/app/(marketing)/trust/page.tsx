import { Section } from "@/components/shared/section";
import { ShieldCheck, Sparkles } from "lucide-react";

export default function TrustPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security By Design</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Trust & Security
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Because Parayu runs completely on-device, you don't have to trust a remote cloud with your microphone. Your voice stays under your control.
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:shadow-lg transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">100% On-Device Processing</h3>
            <p className="text-[#706b61] text-sm md:text-base leading-relaxed font-semibold">
              Every millisecond of audio recorded by Parayu is transcribed locally on your GPU/CPU. Audio files are never sent to external servers or APIs.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:shadow-lg transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">No Model Training</h3>
            <p className="text-[#706b61] text-sm md:text-base leading-relaxed font-semibold">
              We never collect your dictations, transcripts, or custom user dictionaries. We do not use your private voice files to train any models.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
