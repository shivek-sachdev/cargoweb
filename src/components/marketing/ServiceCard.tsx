import Link from "next/link";
import Image from "next/image";

interface ServiceCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    imageUrl?: string;
    href?: string;
}

export default function ServiceCard({
    title,
    description,
    icon,
    imageUrl,
    href = "/site/contact",
}: ServiceCardProps) {
    return (
        <div className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white premium-shadow-hover">
            {imageUrl && (
                <div className="relative h-48 overflow-hidden">
                    <Image
                        src={imageUrl}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                    />
                </div>
            )}
            <div className="flex flex-1 flex-col p-6">
                <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--color-primary-ref)" }}
                >
                    <span className="text-white scale-75">{icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
                <p className="mt-2 flex-1 text-sm text-neutral-600">{description}</p>
                <Link
                    href={href}
                    className="mt-4 inline-flex items-center text-sm font-medium"
                    style={{ color: "var(--color-accent-ref)" }}
                >
                    Learn more
                    <svg
                        className="ml-1 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
