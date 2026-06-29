import { BarChart3, TrendingUp, Clock, FileText } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-white mb-2">
          Analytics
        </h1>
        <p className="text-zinc-400">Track your productivity and voice usage over time.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {[
          { label: "Words Generated", value: "24,592", icon: <FileText className="w-5 h-5 text-violet-400" />, trend: "+12%" },
          { label: "Time Saved", value: "18h 45m", icon: <Clock className="w-5 h-5 text-fuchsia-400" />, trend: "+5%" },
          { label: "Dictation Time", value: "4h 20m", icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, trend: "-2%" },
          { label: "Commands Used", value: "142", icon: <BarChart3 className="w-5 h-5 text-blue-400" />, trend: "+24%" }
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                {stat.icon}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {stat.trend}
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-zinc-500 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 h-80 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Words Generated (Last 30 Days)</h3>
          <div className="flex-1 flex items-end gap-2 justify-between mt-auto">
            {/* Dummy Chart Bars */}
            {[40, 70, 45, 90, 65, 80, 50, 30, 85, 100, 75, 60].map((height, i) => (
              <div key={i} className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-sm transition-colors relative group" style={{ height: `${height}%` }}>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {height * 20}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-4 border-t border-white/5 pt-4">
            <span>Oct 1</span>
            <span>Oct 15</span>
            <span>Oct 31</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 h-80 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Top AI Commands</h3>
          <div className="space-y-4 flex-1">
            {[
              { name: "Draft Email", count: 45, color: "bg-violet-500" },
              { name: "Smart Rewrite", count: 32, color: "bg-fuchsia-500" },
              { name: "Meeting Notes", count: 28, color: "bg-blue-500" },
              { name: "Twitter Thread", count: 15, color: "bg-emerald-500" }
            ].map((cmd, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-32 text-sm text-zinc-300 truncate">{cmd.name}</div>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${cmd.color}`} style={{ width: `${(cmd.count / 45) * 100}%` }}></div>
                </div>
                <div className="w-8 text-right text-xs text-zinc-500 font-mono">{cmd.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
