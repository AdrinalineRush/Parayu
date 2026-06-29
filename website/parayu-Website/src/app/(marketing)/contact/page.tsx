import { Section } from "@/components/shared/section";
import { Mail, Sparkles } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Mail className="w-3.5 h-3.5" />
          <span>Get In Touch</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Contact Us
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          We'd love to hear from you. Please fill out the form below or reach out to us at <span className="text-[#e01e41] font-semibold">support@parayu.com</span>.
        </p>
        <div className="max-w-xl mx-auto bg-white border border-[#e8e5df] p-8 rounded-3xl shadow-xl">
          <form className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold text-[#706b61] mb-1.5">Name</label>
              <input type="text" className="w-full p-3 rounded-xl border border-[#e8e5df] bg-[#f6f4f0] text-[#1c1b19] focus:border-[#e01e41] outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#706b61] mb-1.5">Email</label>
              <input type="email" className="w-full p-3 rounded-xl border border-[#e8e5df] bg-[#f6f4f0] text-[#1c1b19] focus:border-[#e01e41] outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#706b61] mb-1.5">Message</label>
              <textarea rows={5} className="w-full p-3 rounded-xl border border-[#e8e5df] bg-[#f6f4f0] text-[#1c1b19] focus:border-[#e01e41] outline-none transition-colors resize-none"></textarea>
            </div>
            <button className="w-full h-12 rounded-xl bg-[#e01e41] text-white hover:bg-[#d81d54] transition-colors font-bold text-base shadow-lg cursor-pointer">Send Message</button>
          </form>
        </div>
      </Section>
    </div>
  );
}
