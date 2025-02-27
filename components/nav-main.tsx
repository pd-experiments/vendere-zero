"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from 'next/link'
import { motion } from "framer-motion"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

const buttonStyles = "flex w-full items-center gap-2"

// Animation variants for menu items
const menuItemVariants = {
  initial: {
    opacity: 0,
    x: -4,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.15,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    x: 4,
    transition: {
      duration: 0.1,
      ease: "easeIn"
    }
  }
}

// Animation variants for the active indicator
const activeIndicatorVariants = {
  initial: {
    opacity: 0,
    scaleX: 0,
  },
  animate: {
    opacity: 1,
    scaleX: 1,
    transition: {
      duration: 0.2,
      ease: [0.32, 0.72, 0, 1]
    }
  }
}

const MotionLink = motion(Link)
const MotionButton = motion.button

export function NavMain({
  items,
  onItemClick
}: {
  items: NavItem[],
  onItemClick?: (url: string) => void
}) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          if (item.items?.length) {
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.isActive}
                      className="text-muted-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors duration-200 relative"
                    >
                      {item.icon && <item.icon className="text-muted-foreground/60" />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      {item.isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute inset-0 border-l-2 border-sidebar-accent-foreground"
                          variants={activeIndicatorVariants}
                          initial="initial"
                          animate="animate"
                        />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className="text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors duration-200"
                          >
                            {onItemClick ? (
                              <MotionButton
                                onClick={() => onItemClick(subItem.url)}
                                className={cn(buttonStyles, "text-left")}
                                variants={menuItemVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                whileTap={{ scale: 0.98 }}
                              >
                                <span>{subItem.title}</span>
                              </MotionButton>
                            ) : (
                              <MotionLink
                                href={subItem.url}
                                className={buttonStyles}
                                variants={menuItemVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                whileTap={{ scale: 0.98 }}
                              >
                                <span>{subItem.title}</span>
                              </MotionLink>
                            )}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={item.isActive}
                className="text-muted-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors duration-200 relative"
              >
                {onItemClick ? (
                  <MotionButton
                    onClick={() => onItemClick(item.url)}
                    className={cn(buttonStyles, "text-left")}
                    variants={menuItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    whileTap={{ scale: 0.98 }}
                  >
                    {item.icon && <item.icon className="text-muted-foreground/60" />}
                    <span>{item.title}</span>
                    {item.isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 border-l-2 border-sidebar-accent-foreground"
                        variants={activeIndicatorVariants}
                        initial="initial"
                        animate="animate"
                      />
                    )}
                  </MotionButton>
                ) : (
                  <MotionLink
                    href={item.url}
                    className={buttonStyles}
                    variants={menuItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    whileTap={{ scale: 0.98 }}
                  >
                    {item.icon && <item.icon className="text-muted-foreground/60" />}
                    <span>{item.title}</span>
                    {item.isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 border-l-2 border-sidebar-accent-foreground"
                        variants={activeIndicatorVariants}
                        initial="initial"
                        animate="animate"
                      />
                    )}
                  </MotionLink>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
