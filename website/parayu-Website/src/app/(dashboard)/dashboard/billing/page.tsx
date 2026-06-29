import { GradientText } from "@/components/shared/gradient-text";
import { Check, CreditCard, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <GradientText>Billing & Subscription</GradientText>
        </h1>
        <p className="text-zinc-400">Manage your subscription plan, payment methods, and billing history.</p>
      </div>

      {/* Current Plan Card */}
      <div className="glass-card p-6 md:p-8 mb-8 border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              Current Plan
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">Pro Tier</h2>
            <p className="text-zinc-400 mb-6">Unlimited dictation, custom commands, and priority AI generation.</p>
            
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-zinc-500 mb-1">Billing Cycle</p>
                <p className="font-medium text-white">Monthly ($20/mo)</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Next Payment</p>
                <p className="font-medium text-white">July 22, 2026</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button className="bg-white text-zinc-950 hover:bg-zinc-200">
              Manage in Stripe <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="border-white/10 hover:bg-white/5">
              Change Plan
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Payment Method */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-zinc-400" /> Payment Method
          </h3>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-white/5 mb-4">
            <div className="w-12 h-8 rounded bg-zinc-800 flex items-center justify-center border border-white/10 text-xs font-bold text-white">
              VISA
            </div>
            <div>
              <p className="text-white font-medium">•••• •••• •••• 4242</p>
              <p className="text-sm text-zinc-500">Expires 12/28</p>
            </div>
          </div>
          <Button variant="link" className="text-primary p-0 h-auto font-medium">Update payment method</Button>
        </div>

        {/* Invoices */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-zinc-400" /> Billing History
          </h3>
          <div className="space-y-4">
            {[
              { date: "June 22, 2026", amount: "$20.00", status: "Paid" },
              { date: "May 22, 2026", amount: "$20.00", status: "Paid" },
              { date: "April 22, 2026", amount: "$20.00", status: "Paid" },
            ].map((invoice, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">{invoice.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{invoice.amount}</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> {invoice.status}</span>
                </div>
              </div>
            ))}
          </div>
          <Button variant="link" className="text-primary p-0 h-auto font-medium mt-6">View all invoices</Button>
        </div>
      </div>
    </div>
  );
}
