import { Section } from "@/components/shared/section";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-left relative z-10" size="lg">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Privacy Policy
        </h1>
        <p className="text-[#706b61] mb-8 font-semibold">Last updated: October 2024</p>
        <div className="prose max-w-none text-[#706b61] font-medium prose-headings:text-[#1c1b19] prose-a:text-[#e01e41]">
          <p className="leading-relaxed">We respect your privacy. Because Parayu is a 100% offline voice engine running entirely on your machine, your voice recordings and dictated texts are never sent to our servers or stored on any remote database.</p>
          <h2 className="text-[#1c1b19] text-xl font-bold mt-8 mb-3">1. Data Storage & Privacy</h2>
          <p className="leading-relaxed">All voice recordings are processed in memory and immediately discarded. No audio clips or voice logs are saved locally unless you explicitly configure debug recording. No data is used to train public models.</p>
        </div>
      </Section>
    </div>
  );
}
