import { Settings, User, Bell, Lock } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8 text-foreground">
      <div>
        <h1 className="text-3xl font-heading font-black text-foreground mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground font-semibold">Manage your account preferences and app behavior.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-2">
          {[
            { icon: <User className="w-4 h-4" />, label: "Profile", active: true },
            { icon: <Settings className="w-4 h-4" />, label: "Preferences", active: false },
            { icon: <Bell className="w-4 h-4" />, label: "Notifications", active: false },
            { icon: <Lock className="w-4 h-4" />, label: "Security", active: false },
          ].map((tab, i) => (
            <button key={i} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${tab.active ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        
        <div className="md:col-span-3 bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-6">Profile Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Display Name</label>
              <input type="text" defaultValue="Arjun Raj" className="w-full max-w-md p-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Email Address</label>
              <input type="email" defaultValue="arjun@example.com" disabled className="w-full max-w-md p-2.5 bg-secondary border border-border rounded-xl text-muted-foreground/60 text-sm cursor-not-allowed font-semibold" />
            </div>
            <div className="pt-4">
              <button className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors font-bold shadow-md cursor-pointer">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
