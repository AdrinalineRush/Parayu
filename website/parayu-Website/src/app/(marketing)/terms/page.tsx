import { Section } from "@/components/shared/section";

export default function TermsPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-left relative z-10" size="lg">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Terms of Service
        </h1>
        <p className="text-[#706b61] mb-8 font-semibold">Last updated: October 2024</p>
        <div className="prose max-w-none text-[#706b61] font-medium prose-headings:text-[#1c1b19] prose-a:text-[#e01e41]">
          <p className="leading-relaxed">Please read these terms carefully before using Parayu AI.</p>
          <h2 className="text-[#1c1b19] text-xl font-bold mt-8 mb-3">1. License & Usage</h2>
          <p className="leading-relaxed">By accessing the website at parayu.com and purchasing a license to the Parayu software, you agree to be bound by these terms. Parayu is provided as an on-device local voice dictation client. You are granted a personal, non-transferable license to run the software on your devices in accordance with your subscription level.</p>
        </div>
      </Section>
    </div>
  );
}
