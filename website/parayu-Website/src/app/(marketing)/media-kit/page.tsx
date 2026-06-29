import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";
import { LaunchSoonButton } from "@/components/marketing/launch-soon-button";

export default function MediaKitPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Brand Assets</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Media Kit
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Download official Parayu logos, transparent brand assets, and guidelines.
        </p>
        <LaunchSoonButton className="h-12 px-8 rounded-xl bg-[#e01e41] text-white font-bold hover:bg-[#d81d54] transition-colors shadow-[0_8px_30px_rgba(224,30,65,0.18)] cursor-pointer">
          Download All Assets
        </LaunchSoonButton>
      </Section>
    </div>
  );
}
