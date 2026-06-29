import { LifeBuoy, MessageSquare, FileText, CheckCircle2 } from "lucide-react";
import { submitTicket } from "./actions";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-white mb-2">Help & Support</h1>
        <p className="text-zinc-400">We are here to help you get the most out of Parayu.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: <FileText className="w-6 h-6 text-primary" />, title: "Documentation", desc: "Read our guides and tutorials." },
          { icon: <MessageSquare className="w-6 h-6 text-primary" />, title: "Live Chat", desc: "Talk to our support team." },
          { icon: <LifeBuoy className="w-6 h-6 text-primary" />, title: "Email Support", desc: "Send us an email anytime." },
        ].map((c) => (
          <div key={c.title} className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">{c.icon}</div>
            <h3 className="text-lg font-bold text-white mb-2">{c.title}</h3>
            <p className="text-sm text-zinc-400">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Open a ticket</h2>

        {sent && (
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4" /> Ticket submitted — our team will get back to you.
          </div>
        )}
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            Please add a subject and a message.
          </div>
        )}

        <form action={submitTicket} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm text-zinc-300 mb-1.5">Subject</label>
              <input name="subject" required className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none" placeholder="What do you need help with?" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Priority</label>
              <select name="priority" defaultValue="normal" className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Message</label>
            <textarea name="message" required rows={5} className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none resize-y" placeholder="Describe the issue…" />
          </div>
          <button type="submit" className="h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors">
            Submit ticket
          </button>
        </form>
      </div>
    </div>
  );
}
