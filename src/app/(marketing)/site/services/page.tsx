import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/data/marketing-services";

export const metadata: Metadata = {
    title: "Services",
    description:
        "Advanced Export & Logistics Solutions",
};

export default function ServicesPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            {/* Photo banner */}
            <div className="mb-8 aspect-[21/9] overflow-hidden rounded-xl bg-neutral-100 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="https://images.unsplash.com/photo-1767868280782-fc108d087050?q=80&w=1600&auto=format&fit=crop"
                    alt="Air Cargo Infrastructure"
                    className="h-full w-full object-cover"
                />
            </div>

            <div className="mb-16">
                <h1 className="text-3xl font-bold text-neutral-900">Our Services</h1>
                <p className="mt-4 text-lg text-neutral-600">
                    OMGEXP Cargo Portal delivers end-to-end logistics solutions for specialized
                    air freight, customs clearance, pharmaceutical-grade warehousing, and
                    controlled temperature transport. Explore our service offerings below.
                </p>
            </div>

            <nav className="mb-16 flex flex-wrap gap-2">
                {services.map((service) => (
                    <a
                        key={service.id}
                        href={`#${service.id}`}
                        className="rounded-full px-4 py-2 text-sm font-medium transition active:scale-95"
                        style={{
                            backgroundColor: "var(--color-primary-ref)",
                            color: "white",
                        }}
                    >
                        {service.title}
                    </a>
                ))}
            </nav>

            <div className="space-y-24">
                {services.map((service) => (
                    <section
                        key={service.id}
                        id={service.id}
                        className="scroll-mt-24"
                    >
                        <h2 className="text-2xl font-bold text-neutral-900">
                            {service.title}
                        </h2>
                        <p className="mt-4 text-neutral-600">
                            {service.shortDescription}
                        </p>
                        <div className="mt-6 space-y-4 text-neutral-600">
                            {service.fullDescription.split("\n\n").map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>
                        <Link
                            href="/site/contact"
                            className="mt-6 inline-flex items-center text-sm font-semibold transition hover:opacity-80"
                            style={{ color: "var(--color-accent-ref)" }}
                        >
                            Request a quote
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
                    </section>
                ))}
            </div>
        </div>
    );
}
