import { Section } from "@/components/shared/section";
import { Code, MessageSquare, Layout, Mail, FileText, Terminal, Layers, Sparkles } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>System-Wide Typing</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Works where you do.
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto font-medium">
          Parayu requires <strong className="text-[#e01e41] font-bold">zero API integrations</strong> or OAuth configuration. Because it inputs directly via keyboard events, it functions in every editor, input field, and terminal out of the box.
        </p>
      </Section>
      
      <Section className="pb-32 relative z-10" size="lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { icon: <MessageSquare className="w-8 h-8 text-[#e01e41]" />, name: "Slack" },
            { icon: <Code className="w-8 h-8 text-blue-600" />, name: "VS Code / Cursor" },
            { icon: <FileText className="w-8 h-8 text-amber-600" />, name: "Notion" },
            { icon: <Mail className="w-8 h-8 text-rose-600" />, name: "Gmail" },
            { icon: <Terminal className="w-8 h-8 text-emerald-600" />, name: "Terminal / CLI" },
            { icon: <Layout className="w-8 h-8 text-indigo-600" />, name: "Trello" },
            { icon: <Layers className="w-8 h-8 text-pink-600" />, name: "Jira / Linear" },
            { icon: <Sparkles className="w-8 h-8 text-teal-600" />, name: "Any Browser Form" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-8 rounded-3xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] hover:border-[#e01e41]/30 hover:shadow-xl shadow-sm transition-all cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-[#f6f4f0] border border-[#e8e5df] flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <span className="font-bold text-[#1c1b19] text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
