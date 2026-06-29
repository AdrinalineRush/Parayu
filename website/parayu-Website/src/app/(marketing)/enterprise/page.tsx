import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { ShieldCheck, Server, Users, Lock, Key, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EnterprisePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] font-bold text-xs uppercase tracking-wider mb-6">
          <Lock className="w-3.5 h-3.5" /> Enterprise-Grade
        </div>
        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
          Secure AI for your <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e81f3a] via-[#d81d54] to-[#a02bb0]">entire organization.</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
          Deploy Parayu locally across your workforce. Audio processing is kept strictly local, ensuring total confidentiality and compliance without complex VPC setups.
        </p>
        <Button size="lg" className="h-14 px-8 text-lg rounded-xl bg-[#e01e41] text-white hover:bg-[#d81d54] transition-all duration-300 font-bold shadow-xl cursor-pointer">
          Contact Sales
        </Button>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <BentoGrid className="max-w-5xl mx-auto">
          <BentoGridItem
            title="100% On-Device Compliance"
            description="Since all audio models run locally on CPU/GPU hardware, no employee voices or dictated text are transmitted to the cloud. Inherently compliant out of the box."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span className="text-emerald-600 font-bold">✓ Audio Data Transmission: 0 KB</span>
              </div>
            }
            icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
            className="md:col-span-2"
          />
          <BentoGridItem
            title="Standard Installers"
            description="Easily deploy Parayu to macOS and Windows machines using standard silent MSI or PKG installers with preloaded license keys."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span className="font-mono">msiexec /i ParayuSetup.msi /qn</span>
              </div>
            }
            icon={<Key className="h-5 w-5 text-blue-600" />}
            className="md:col-span-1"
          />
          <BentoGridItem
            title="Zero Network Dependency"
            description="Runs fully offline without requesting network ports or consuming proxy bandwidth. Transcribe anywhere, even on secure air-gapped devices."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span className="text-[#706b61] font-bold">Network State: Offline</span>
              </div>
            }
            icon={<Server className="h-5 w-5 text-[#706b61]" />}
            className="md:col-span-1"
          />
          <BentoGridItem
            title="Shared Organization Dictionary"
            description="Distribute standard custom vocabularies, domain terminology, internal jargon, and product acronyms across all company installations seamlessly."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 text-xs text-[#706b61] shadow-inner font-medium">
                <span>"Org Dictionary Loaded: 432 terms"</span>
              </div>
            }
            icon={<Users className="h-5 w-5 text-violet-600" />}
            className="md:col-span-2"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
