import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  containerClassName?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  background?: "default" | "muted" | "dark" | "gradient" | "glass";
}

export function Section({
  children,
  className,
  containerClassName,
  size = "lg",
  background = "default",
  ...props
}: SectionProps) {
  const sizeClasses = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    xl: "max-w-[96rem]",
    full: "max-w-full",
  };

  const backgroundClasses = {
    default: "bg-transparent",
    muted: "bg-zinc-900/50",
    dark: "bg-zinc-950",
    gradient: "bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950",
    glass: "bg-zinc-950/80 backdrop-blur-xl border-y border-white/5",
  };

  const isOverflowHidden = !className?.includes("overflow-visible");

  return (
    <section
      className={cn("relative py-16 md:py-24", isOverflowHidden && "overflow-hidden", backgroundClasses[background], className)}
      {...props}
    >
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 w-full", sizeClasses[size], containerClassName)}>
        {children}
      </div>
    </section>
  );
}
