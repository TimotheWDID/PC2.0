import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight, Plus } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const isActive = page.url.startsWith(
                        typeof item.href === 'string' ? item.href : item.href.url,
                    );

                    // If item has sub-items, render as Collapsible
                    if (item.items && item.items.length > 0) {
                        return (
                            <Collapsible
                                key={item.title}
                                asChild
                                defaultOpen={isActive}
                                className="group/collapsible"
                            >
                                <SidebarMenuItem>
                                    <div className="flex items-center gap-1">
                                        <SidebarMenuButton
                                            asChild
                                            tooltip={{ children: item.title }}
                                            isActive={isActive}
                                            className="min-h-10 flex-1"
                                        >
                                            <Link href={item.href} prefetch>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton
                                                tooltip={{ children: `Ouvrir ${item.title}` }}
                                                className="min-h-10 w-8 shrink-0 justify-center px-0"
                                            >
                                                <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                    </div>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {item.items.map((subItem) => {
                                                const subHref = typeof subItem.href === 'string' ? subItem.href : subItem.href.url;
                                                const isSubActive = page.url === subHref || page.url.startsWith(subHref + '?');
                                                return (
                                                    <SidebarMenuSubItem key={subItem.title}>
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            isActive={isSubActive}
                                                            className="min-h-10"
                                                        >
                                                            <Link href={subItem.href} prefetch>
                                                                <span>{subItem.title}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                );
                                            })}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        );
                    }

                    // Regular menu item without sub-items
                    return (
                        <SidebarMenuItem key={item.title}>
                            <div className="flex items-center gap-1">
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    tooltip={{ children: item.title }}
                                    className="min-h-10 flex-1"
                                >
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>

                                {item.quickHref && (
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={{ children: item.quickLabel ?? `Ajouter ${item.title}` }}
                                        className="hidden min-h-10 w-8 shrink-0 justify-center px-0 md:inline-flex group-data-[collapsible=icon]:hidden"
                                    >
                                        <Link href={item.quickHref} prefetch>
                                            <Plus className="h-4 w-4" />
                                        </Link>
                                    </SidebarMenuButton>
                                )}
                            </div>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
