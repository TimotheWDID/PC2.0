export default function HeadingSmall({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <header className="rounded-xl border border-border/60 bg-gradient-to-r from-[#141d3a] via-[#1f2b57] to-[#2a3ff5] px-4 py-3 text-white shadow-sm">
            <h3 className="mb-0.5 text-base font-medium">{title}</h3>
            {description && (
                <p className="text-sm text-white/85">{description}</p>
            )}
        </header>
    );
}
