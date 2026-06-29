import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  as?: "span" | "div";
}

export function GradientText({ children, className, as: Component = "span", ...props }: GradientTextProps) {
  return (
    <Component className={cn("text-gradient font-bold", className)} {...props}>
      {children}
    </Component>
  );
}
