export default function Heading({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="mb-4 rounded-2xl border border-border/60 bg-gradient-to-r from-[#141d3a] via-[#1f2b57] to-[#2a3ff5] p-4 text-white shadow-sm sm:mb-8 sm:p-5">
            <div className="mb-2 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/90">
                Espace de travail
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
            {description && (
                <p className="mt-1 text-sm text-white/85">{description}</p>
            )}
        </div>
    );
}
