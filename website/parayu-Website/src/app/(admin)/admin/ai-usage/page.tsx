import { Mic, Type, Clock, Activity } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Aggregated from the voice_notes table — no separate usage table needed.
export const dynamic = "force-dynamic";

interface NoteRow {
  user_id: string | null;
  words_generated: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export default async function AiUsagePage() {
  const { data } = await supabaseAdmin()
    .from("voice_notes")
    .select("user_id, words_generated, duration_seconds, created_at");

  const notes: NoteRow[] = data ?? [];
  const totalNotes = notes.length;
  const totalWords = notes.reduce((s, n) => s + (n.words_generated ?? 0), 0);
  const totalSeconds = notes.reduce((s, n) => s + (n.duration_seconds ?? 0), 0);
  const activeUsers = new Set(notes.map((n) => n.user_id).filter(Boolean)).size;
  const hours = (totalSeconds / 3600).toFixed(1);

  // Last 14 days of word volume for a simple bar sparkline.
  const days: { label: string; words: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const words = notes
      .filter((n) => n.created_at.slice(0, 10) === key)
      .reduce((s, n) => s + (n.words_generated ?? 0), 0);
    days.push({ label: key.slice(5), words });
  }
  const maxWords = Math.max(1, ...days.map((d) => d.words));

  const stats = [
    { title: "Total Notes", value: totalNotes.toLocaleString("en-IN"), icon: <Mic className="w-4 h-4 text-primary" /> },
    { title: "Words Generated", value: totalWords.toLocaleString("en-IN"), icon: <Type className="w-4 h-4 text-fuchsia-400" /> },
    { title: "Audio Processed", value: `${hours} h`, icon: <Clock className="w-4 h-4 text-amber-400" /> },
    { title: "Active Users", value: activeUsers.toLocaleString("en-IN"), icon: <Activity className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">AI Usage</h1>
        <p className="text-zinc-400">Live transcription volume aggregated from Supabase.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-zinc-400 text-sm font-medium">{s.title}</h3>{s.icon}
            </div>
            <span className="text-3xl font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-bold text-white mb-6">Words generated · last 14 days</h3>
        <div className="flex items-end gap-2 h-48">
          {days.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-violet-600 to-fuchsia-500 rounded-t" style={{ height: `${(d.words / maxWords) * 100}%` }} title={`${d.words} words`} />
              <span className="text-[9px] text-zinc-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
