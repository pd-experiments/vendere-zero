"use client"

import * as React from "react"
import {
  AudioWaveform,
  Command,
  Ratio,
  GalleryVerticalEnd,
  BookIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

const data = {
  user: {
    name: "Dinesh Vasireddy",
    email: "dinesh@venderelabs.com",
    avatar: "/avatars/dinesh.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Library",
      url: "/evaluate",
      icon: BookIcon
    },
    // {
    //   title: "Creative",
    //   url: "#",
    //   icon: SquareTerminal,
    //   isActive: true,
    //   items: [
    //     // {
    //     //   title: "Assets",
    //     //   url: "/assets",
    //     // },
    //     {
    //       title: "Evaluate",
    //       url: "/evaluate",
    //     },
    //   ],
    // },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pb-2">
        <div className="flex items-center gap-2 px-0 py-3 transition-all duration-300 ease-in-out group-data-[state=collapsed]:px-0">
          <div className="flex items-center justify-center w-8 h-8 transition-all duration-300 ease-in-out">
            <Ratio className="h-6 w-6 bg-[#B1E116] text-black p-1 rounded-md transition-all duration-300 ease-in-out" />
          </div>
          <span className="font-light text-lg text-[#B1E116] opacity-100 transition-all duration-300 ease-in-out group-data-[state=collapsed]:hidden">
            vendere
          </span>
        </div>
        <Separator className="mt-2 opacity-50" />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        {/* <TeamSwitcher teams={data.teams} /> */}
        <div className="mt-auto px-3 py-1 group-data-[state=collapsed]:hidden">
          <div className="inline-flex items-center gap-1.5 rounded-sm border border-border/30 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
            <Command className="h-2.5 w-2.5" />
            <span className="font-medium">E to Collapse</span>
          </div>
        </div>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
