import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { type User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
}: {
    user?: User | null;
    showEmail?: boolean;
}) {
    const getInitials = useInitials();

    // Prefer `name` (virtual attribute), but fall back to `first_name` + `last_name`
    // because some backends may only send those separately.
    const name = user?.name ?? [user?.first_name, user?.last_name].filter(Boolean).join(' ') ?? '';
    const avatar = user?.avatar ?? undefined;

    return (
        <>
            <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
                <AvatarFallback className="rounded-lg bg-muted text-foreground">
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                {showEmail && user?.email && (
                    <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                )}
            </div>
        </>
    );
}

