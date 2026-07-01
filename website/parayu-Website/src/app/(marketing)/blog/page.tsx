"use client";

import { useState } from "react";
import { Section } from "@/components/shared/section";
import { Sparkles, Search, Calendar, Clock, ArrowRight, User, X, Check, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";

interface BlogPost {
  id: string;
  title: string;
  category: "Product Updates" | "Engineering" | "Guides";
  date: string;
  readTime: string;
  summary: string;
  author: string;
  authorRole: string;
  imageGlow: string;
  content: string[];
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: "local-engine-launch",
    title: "Introducing Parayu Local Engine: Privacy-First Offline Voice Dictation for macOS & Windows",
    category: "Product Updates",
    date: "June 30, 2026",
    readTime: "5 min read",
    summary: "Today we are thrilled to announce the next generation of our offline voice engine running whisper.cpp locally. Get fast, secure, zero-internet AI dictation.",
    author: "Sebin Sabu",
    authorRole: "Founder, Parayu",
    imageGlow: "from-emerald-500 to-teal-600",
    content: [
      "We built Parayu because we believe your voice should belong to you. In a world where cloud-based AI tools record, stream, and process your personal dictation on remote servers, we wanted to build a complete offline, zero-compromise alternative.",
      "Today, we are launching the Parayu Local Engine. Powered by an optimized compilation of whisper.cpp and on-device CoreML/DirectML execution, Parayu lets you type with your voice anywhere on your system without an internet connection.",
      "### Why Offline Voice Recognition Matters",
      "Most modern voice dictation apps require an active internet connection to stream your audio to cloud API endpoints. This introduces three critical problems: network latency, internet dependency, and massive privacy risks. If you are drafting a private email, a proprietary code block, or client notes, sending that audio to a third party is a security vulnerability.",
      "Parayu solves this by running state-of-the-art quantized Whisper models directly on your CPU and GPU. Your audio is transcribed locally in memory, pasted into your active application, and immediately destroyed. Zero data is cached, zero data is uploaded, and it works perfectly on a flight or in areas with poor cellular reception.",
      "### Dual Model Architecture",
      "The new engine supports two primary configurations optimized for different hardware profiles:",
      "- **MAX Model (4-bit Quantized)**: Offers maximum accuracy with extremely low memory requirements. It uses 4-bit integer quantization to reduce the model footprint while retaining 99% of the transcription quality, running flawlessly on standard consumer laptops.",
      "- **PRO Model (16-bit Float)**: Designed for high-end Apple Silicon and NVIDIA rigs. It processes unquantized weights to achieve state-of-the-art accuracy, adapting easily to thick accents and noisy background environments.",
      "### Malayalam Native Support",
      "As part of this launch, we are promoting native Malayalam dictation support. Parayu can now listen to Malayalam speech and output native script directly, completely offline. We have optimized column sorting and custom dictionary mappings to ensure accuracy is higher than standard translation engines.",
      "The Parayu Local Engine is available as a free download for macOS and Windows starting today. Join us in making dictation fast, secure, and private."
    ]
  },
  {
    id: "malayalam-whisper-optimization",
    title: "How We Optimized whisper.cpp for Malayalam: Native Script Output Without Cloud Translation",
    category: "Engineering",
    date: "June 25, 2026",
    readTime: "4 min read",
    summary: "Malayalam voice typing has traditionally suffered from lag and translation errors in cloud pipelines. Here is how we bypassed Whisper translation logic to write native Malayalam script directly on your computer.",
    author: "Hariprasad",
    authorRole: "Core AI Engineer",
    imageGlow: "from-[#e01e41] to-purple-600",
    content: [
      "Transcribing local Indic languages with high accuracy on-device has always been a hard engineering challenge. Most open-source speech models default to translating non-English speech into English, or fail to output complex scripts like Malayalam correctly.",
      "When compiling the whisper.cpp runtime for Parayu, we set out to build a native Malayalam dictation pipeline that runs 100% locally with zero translation latency. Here is a technical breakdown of how we achieved it.",
      "### Bypassing Default Translation Logic",
      "Whisper models naturally output translation tokens when prompted. In standard setups, developers pass the `--translate` flag or default language settings. To ensure native Malayalam output, we modified the model parameters passed to the transcription engine:",
      "1. We force-disable translation mode by setting `translate: false` in the Whisper model parameters.",
      "2. We explicitly inject the Malayalam language token (`ml`) and prompt the model with common local terms to initialize correct spelling contexts.",
      "3. We bypass screenwriting translate conditions, allowing direct phonetic mappings.",
      "### Optimizing Column & Language Priorities",
      "In our UI, we implemented a custom function `getOrderedScreenwritingLangs()` that dynamically positions Malayalam as the primary column on the left side of the dashboard, optimizing layouts for our core user base. Here is a snippet of our language sorting algorithm:",
      "```typescript\nexport function getOrderedScreenwritingLangs() {\n  const list = [...SUPPORTED_LANGUAGES];\n  // Malayalam (ml) is positioned first\n  const mlIndex = list.findIndex(l => l.code === 'ml');\n  if (mlIndex > -1) {\n    const [ml] = list.splice(mlIndex, 1);\n    return [ml, ...list];\n  }\n  return list;\n}\n```",
      "### Handling System RAM Constraints",
      "Running native Malayalam models locally requires careful memory alignment. By using 16-bit floating point weights optimized for Apple Silicon Metal framework and Windows DirectML, we enabled real-time transcription speeds (under 1.5x audio length) while keeping RAM consumption under 1.2GB. This ensures the app can remain running in the background of your system without slowing down other tools.",
      "We are continuing to refine our custom Indic dictionaries. If you notice any spelling edge cases, you can add them to your local personal dictionary inside the Parayu desktop app."
    ]
  },
  {
    id: "offline-vs-cloud-dictation",
    title: "Offline Dictation vs Cloud Subscriptions: Wispr Flow Comparison Guide",
    category: "Guides",
    date: "June 18, 2026",
    readTime: "6 min read",
    summary: "Compare privacy policies, local processing performance, battery drain, internet dependency, and the lifetime costs of offline vs subscription-based cloud dictation.",
    author: "Anjali Menon",
    authorRole: "Product Lead",
    imageGlow: "from-amber-500 to-[#e01e41]",
    content: [
      "Selecting the right AI dictation tool comes down to a trade-off between where the data is processed and how you are billed. While cloud-based voice apps like Wispr Flow offer polished integrations, they come with permanent monthly costs and strict data tracking policies.",
      "In this guide, we break down the core differences between offline-first architectures (Parayu) and cloud-first architectures (Wispr Flow) to help you choose the best fit for your workflow.",
      "### 1. Privacy and Data Security",
      "The most fundamental difference is what happens to your audio:",
      "- **Wispr Flow**: Streams your voice recordings to remote cloud servers (using OpenAI and custom API backends). To provide context-awareness, the client app can take screenshots of your active window or query window titles. While this helps refine dictation vocabulary, it means sensitive screen content and audio recordings leave your machine.",
      "- **Parayu**: Processes 100% of your voice data locally in system memory. No audio files are ever written to disk or sent across the network. Because the AI model runs on your machine's GPU or CPU, your data remains fully sandboxed on your device.",
      "### 2. Latency and Offline Availability",
      "Network dependency determines where you can use the tool:",
      "- **Wispr Flow**: Requires a stable, fast internet connection. If you are on a flight, traveling in remote areas, or working on a spotty public Wi-Fi network, the service will lag or fail to transcribe.",
      "- **Parayu**: Works everywhere with zero internet. Because the Whisper model is fully packaged within the application, transcription speeds are determined solely by your hardware and do not suffer from network packet drops.",
      "### 3. Cost & Subscriptions",
      "Pricing models vary significantly:",
      "- **Wispr Flow**: Offers a capped free tier (approx. 2,000 words/week) with Pro subscriptions at $15/month (or $144/year).",
      "- **Parayu**: Offers a capped free tier (2,500 words/week) with Pro subscriptions at ₹399/month (approx. $5/mo) to unlock unlimited dictation, all AI models, and native Malayalam support offline — saving you over 65% on Pro features.",
      "### Summary Recommendation",
      "If you need cross-device cloud sync and are comfortable with online audio processing, Wispr Flow is a solid choice. However, if privacy is your priority, you travel frequently, or you want to save over 65% on Pro subscription fees, Parayu provides a highly secure, native, offline-first alternative."
    ]
  }
];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<"All" | "Product Updates" | "Engineering" | "Guides">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const categories: ("All" | "Product Updates" | "Engineering" | "Guides")[] = [
    "All",
    "Product Updates",
    "Engineering",
    "Guides"
  ];

  // Filter posts
  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCategory = activeCategory === "All" || post.category === activeCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen relative overflow-hidden transition-colors duration-300">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <Section className="pt-32 pb-12 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Insights & Updates</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-heading font-black text-zinc-950 dark:text-white mb-6 tracking-tight">
          The <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e01e41] to-purple-600">Parayu</span> Blog
        </h1>
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12 font-medium">
          News, deep technical deep-dives, and guides on local speech recognition and private voice technology.
        </p>

        {/* Search & Filter Bar */}
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between p-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md">
          <div className="relative w-full sm:w-72 flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-transparent border-0 outline-none focus:ring-0 text-zinc-900 dark:text-white placeholder-zinc-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeCategory === cat
                    ? "bg-[#e01e41] text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Posts Section */}
      <Section className="pb-32 relative z-10" size="lg">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto">
            <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No posts found</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Try tweaking your search query or switching categories.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="flex flex-col justify-between group cursor-pointer bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-[#e01e41]/35 dark:hover:border-[#e01e41]/35 hover:shadow-xl dark:hover:shadow-[#e01e41]/5 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${post.imageGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      post.category === "Product Updates" 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : post.category === "Engineering"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {post.category}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{post.date}</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-heading font-black text-zinc-900 dark:text-white group-hover:text-[#e01e41] dark:group-hover:text-[#e01e41] transition-colors leading-tight mb-3">
                    {post.title}
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 font-medium line-clamp-3">
                    {post.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[#e01e41]">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{post.author}</div>
                      <div className="text-[10px] text-zinc-400 font-medium">{post.authorRole}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center text-xs font-bold text-[#e01e41] gap-1 group-hover:translate-x-1 transition-transform duration-300">
                    Read Post <Clock className="w-3.5 h-3.5 ml-1 text-zinc-400" /> <span className="text-[10px] text-zinc-400 font-normal">{post.readTime}</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      {/* Reader Modal Overlay */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-3xl h-full bg-white dark:bg-zinc-900 shadow-2xl p-6 md:p-12 overflow-y-auto flex flex-col gap-6 relative animate-in slide-in-from-right duration-300">
            {/* Close Button */}
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mt-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
                selectedPost.category === "Product Updates" 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : selectedPost.category === "Engineering"
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}>
                {selectedPost.category}
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-black text-zinc-950 dark:text-white tracking-tight leading-tight mb-4">
                {selectedPost.title}
              </h2>

              <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{selectedPost.date}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{selectedPost.readTime}</span>
                <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{selectedPost.author} ({selectedPost.authorRole})</span>
              </div>
            </div>

            {/* Content */}
            <div className="prose dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium space-y-6">
              {selectedPost.content.map((paragraph, index) => {
                if (paragraph.startsWith("### ")) {
                  return (
                    <h4 key={index} className="text-xl font-heading font-black text-zinc-950 dark:text-white mt-8 mb-4">
                      {paragraph.replace("### ", "")}
                    </h4>
                  );
                }
                if (paragraph.startsWith("- ")) {
                  const boldPartEnd = paragraph.indexOf(":") + 1;
                  return (
                    <ul key={index} className="list-disc list-inside pl-4 space-y-2 text-sm md:text-base">
                      <li>
                        {boldPartEnd > 1 ? (
                          <>
                            <strong className="text-zinc-900 dark:text-white">
                              {paragraph.substring(2, boldPartEnd)}
                            </strong>
                            {paragraph.substring(boldPartEnd)}
                          </>
                        ) : (
                          paragraph.substring(2)
                        )}
                      </li>
                    </ul>
                  );
                }
                if (paragraph.startsWith("```")) {
                  const code = paragraph.replace(/```[a-z]*/g, "").trim();
                  return (
                    <pre key={index} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-4 rounded-xl text-xs overflow-x-auto text-[#e01e41] font-mono leading-relaxed mt-4 mb-4">
                      <code>{code}</code>
                    </pre>
                  );
                }
                return (
                  <p key={index} className="text-base">
                    {paragraph}
                  </p>
                );
              })}
            </div>

            {/* Footer / CTA */}
            <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[#e01e41] font-bold">
                  {selectedPost.author[0]}
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{selectedPost.author}</div>
                  <div className="text-xs text-zinc-400 font-medium">{selectedPost.authorRole}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                Back to Blog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
