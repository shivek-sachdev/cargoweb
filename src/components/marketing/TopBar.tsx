import Link from "next/link";

const pinnedAnnouncement = {
    title: "OMGEXP Cargo Portal Expands European Air Freight Routes — New direct services to Zurich, Lisbon, and Warsaw",
    slug: "new-european-routes-2025",
};

export default function TopBar() {
    return (
        <div
            className="flex min-h-[40px] items-center justify-center border-b border-white/20 px-6 py-2.5 text-center text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: "var(--color-accent-ref)" }}
        >
            <span className="line-clamp-1">
                {pinnedAnnouncement.title}{" "}
                <Link
                    href={`/site/newsroom/${pinnedAnnouncement.slug}`}
                    className="underline underline-offset-2 transition hover:opacity-90 active:opacity-80"
                >
                    Read more
                </Link>
            </span>
        </div>
    );
}
