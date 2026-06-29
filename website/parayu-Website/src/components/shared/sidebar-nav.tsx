"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Book, FileCode2, Settings } from "lucide-react";

interface SidebarNavProps {
  navItems: {
    name: string;
    href: string;
    icon: React.ReactNode;
  }[];
}

export function SidebarNav({ navItems }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              isActive
                ? "bg-[#fbebee] text-[#e01e41] border-l-[3.5px] border-[#e01e41] rounded-r-xl"
                : "text-[#1c1b19] hover:bg-[#faeef0]/40 hover:text-[#e01e41] rounded-xl border-l-[3.5px] border-transparent"
            }`}
          >
            <div className={`${isActive ? "text-[#e01e41]" : "text-[#706b61] group-hover:text-[#e01e41]"}`}>
              {item.icon}
            </div>
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
