"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VoiceWaveformProps {
  isListening?: boolean;
  className?: string;
  bars?: number;
}

export function VoiceWaveform({ isListening = true, className, bars = 5 }: VoiceWaveformProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={cn("flex items-center gap-[3px] h-6", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        // Create an interesting initial pattern
        const initialHeight = isListening ? [3, 8, 4, 10, 5][i % 5] : 2;
        
        return (
          <motion.div
            key={i}
            className="w-1 bg-violet-500 rounded-full"
            initial={{ height: initialHeight }}
            animate={{
              height: isListening 
                ? [
                    initialHeight, 
                    Math.max(4, Math.random() * 20 + 4), 
                    Math.max(4, Math.random() * 20 + 4), 
                    initialHeight
                  ] 
                : 2
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}
