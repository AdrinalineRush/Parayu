import Link from "next/link";
import { Mic } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#e8e5df] pt-16 pb-8 bg-[#f6f4f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:rotate-[-2deg]">
                <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(124,92,255,0.2)]" />
              </div>
              <span className="font-heading font-bold text-xl text-zinc-950 dark:text-white tracking-tight">Parayu</span>
            </Link>
            <p className="text-[#706b61] text-sm max-w-xs mb-6 font-medium">
              A local, offline voice dictation app for macOS and Windows. Speak in Malayalam or English slang and watch it type clean, polished English system-wide.
            </p>
            <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
              <Link href="#" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="#" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-zinc-950 dark:text-white mb-4">Product</h3>
            <ul className="space-y-3">
              <li><Link href="/features" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Features</Link></li>
              <li><Link href="/commands" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">AI Commands</Link></li>
              <li><Link href="/languages" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">100+ Languages</Link></li>
              <li><Link href="/integrations" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Integrations</Link></li>
              <li><Link href="/pricing" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Pricing</Link></li>
              <li><Link href="/enterprise" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Enterprise</Link></li>
            </ul>
          </div>
 
          <div>
            <h3 className="font-semibold text-zinc-950 dark:text-white mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><Link href="/blog" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Blog</Link></li>
              <li><Link href="/parayu-vs-wispr-flow" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Parayu vs Wispr Flow</Link></li>
              <li><Link href="/use-cases" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Use Cases</Link></li>
              <li><Link href="/docs" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Documentation</Link></li>
              <li><Link href="/help" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Help Center</Link></li>
              <li><Link href="/affiliate" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Affiliate Program</Link></li>
              <li><Link href="/media-kit" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Media Kit</Link></li>
            </ul>
          </div>
 
          <div>
            <h3 className="font-semibold text-zinc-950 dark:text-white mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">About Us</Link></li>
              <li><Link href="/careers" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Careers</Link></li>
              <li><Link href="/trust" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Trust Center</Link></li>
              <li><Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Terms of Service</Link></li>
              <li><Link href="/contact" className="text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary text-sm transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
 
        <div className="pt-8 border-t border-zinc-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            © {new Date().getFullYear()} Parayu AI. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>Built with</span>
            <span className="text-primary font-medium">Next.js 15</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
