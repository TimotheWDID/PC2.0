import { Breadcrumbs } from '@/components/breadcrumbs';
import { GlobalSearch } from '@/components/global-search';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-3 transition-[width,height] ease-linear sm:h-16 sm:px-4 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="hidden w-full max-w-xl md:block lg:max-w-2xl">
                <GlobalSearch />
            </div>
        </header>
    );
}
