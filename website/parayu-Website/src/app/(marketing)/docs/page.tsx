import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Guides & Resources</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Documentation
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto font-medium">
          Learn how to set up local models, configure custom dictionaries, and master on-device voice commands.
        </p>
      </Section>
      <Section className="pb-32 relative z-10" size="lg">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:bg-[#f6f4f0] shadow-sm hover:shadow-md cursor-pointer transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">Getting Started</h3>
            <p className="text-[#706b61] text-sm md:text-base font-medium">Installation on macOS & Windows, setting up local dictation, and your first transcribing session.</p>
          </div>
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:bg-[#f6f4f0] shadow-sm hover:shadow-md cursor-pointer transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">Voice Commands</h3>
            <p className="text-[#706b61] text-sm md:text-base font-medium">A complete reference guides of all available offline formatting commands like /translate and /polish.</p>
          </div>
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:bg-[#f6f4f0] shadow-sm hover:shadow-md cursor-pointer transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">System-Wide Hotkeys</h3>
            <p className="text-[#706b61] text-sm md:text-base font-medium">How to adjust the default dictation hotkey (Option + Space) and control system-wide typing focus.</p>
          </div>
          <div className="p-8 rounded-3xl bg-white border border-[#e8e5df] hover:border-[#e01e41]/30 hover:bg-[#f6f4f0] shadow-sm hover:shadow-md cursor-pointer transition-all duration-300">
            <h3 className="text-xl font-bold text-[#1c1b19] mb-2">User Dictionary</h3>
            <p className="text-[#706b61] text-sm md:text-base font-medium">Adding custom acronyms, jargon, and Malayalam mappings to train your local transcriber.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
