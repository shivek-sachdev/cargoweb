import type { Metadata } from "next";
import ContactForm from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
    title: "Contact Us",
    description:
        "Request a quote for air freight, customs clearance, warehousing, or controlled temperature transport. OMGEXP Cargo Portal logistics team.",
};

export default function ContactPage() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-neutral-900">Contact Us</h1>
            <p className="mt-6 text-neutral-600">
                Request a quote for your air freight, customs clearance, warehousing, or
                controlled temperature transport requirements. Our team will respond
                within one business day.
            </p>
            <ContactForm />
        </div>
    );
}
