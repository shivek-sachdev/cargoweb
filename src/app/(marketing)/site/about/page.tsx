import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About Us",
    description:
        "OMGEXP Cargo Portal: From GSA and airline distribution heritage to specialized pharmaceutical-grade logistics. Industry expertise and routing intelligence.",
};

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-neutral-900">About Us</h1>

            {/* Photo banner */}
            <div className="mt-8 aspect-video overflow-hidden rounded-xl bg-neutral-100 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?q=80&w=1200&auto=format&fit=crop"
                    alt="International Air Freight Hub"
                    className="h-full w-full object-cover"
                />
            </div>

            <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                    From Airline Distribution to Specialized Logistics
                </h2>
                <p className="mt-4 text-neutral-600">
                    OMGEXP Cargo Portal has built its expertise on a foundation of traditional
                    airline distribution and GSA (General Sales Agent) heritage. Our deep
                    understanding of aviation networks and cargo operations has enabled us
                    to transition into specialized pharmaceutical-grade logistics.
                </p>
                <p className="mt-4 text-neutral-600">
                    Today, we combine that legacy with modern technology to deliver
                    speed, compliance, and traceability for every shipment.
                </p>
            </section>

            <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                    The Intel Advantage
                </h2>
                <p className="mt-4 text-neutral-600">
                    Our parent company&apos;s airline knowledge provides unique access to
                    routing intelligence and capacity insights. This translates into
                    documentation and visibility via the Export Portal for your most
                    critical shipments—whether time-sensitive pharmaceuticals, specialized
                    equipment, or high-value cargo.
                </p>
                <p className="mt-4 text-neutral-600">
                    We leverage industry data and relationships to optimize every route,
                    document, and handoff.
                </p>
            </section>

            <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                    Our Values
                </h2>
                <ul className="mt-4 space-y-2 text-neutral-600">
                    <li className="flex items-start gap-2">
                        <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-accent-ref)" }}
                        />
                        <span>Professionalism and reliability</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-accent-ref)" }}
                        />
                        <span>Regulatory compliance and transparency</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-accent-ref)" }}
                        />
                        <span>Technology-driven traceability</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-accent-ref)" }}
                        />
                        <span>Customer-focused service</span>
                    </li>
                </ul>
            </section>
        </div>
    );
}
