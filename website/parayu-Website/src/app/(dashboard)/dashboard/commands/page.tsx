import { Terminal, Plus, Edit2, Trash2 } from "lucide-react";

export default function CustomCommandsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Custom Commands</h1>
          <p className="text-zinc-400">Create your own voice macros to automate repetitive formatting.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> New Command
        </button>
      </div>

      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
        <div className="space-y-4">
          {[
            { trigger: "Weekly Update", prompt: "Format as a weekly update bulleted list with 'Wins', 'Losses', and 'Next Steps'." },
            { trigger: "Code Review", prompt: "Format as a code review feedback with markdown, highlighting good parts and suggestions." }
          ].map((cmd, i) => (
            <div key={i} className="flex items-start justify-between p-4 rounded-xl border border-white/5 bg-zinc-950">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span className="font-bold text-zinc-100">{cmd.trigger}</span>
                </div>
                <p className="text-sm text-zinc-500">{cmd.prompt}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
