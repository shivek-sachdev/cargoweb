import type { Metadata } from "next";
import ResourcesList from "@/components/marketing/ResourcesList";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
    title: "Resources",
    description:
        "Export and customs reading instructions. Guides for EU compliance, destination requirements, and documentation.",
};

export const dynamic = 'force-dynamic';

export default async function ResourcesPage() {
    const supabase = getSupabaseServerClient();
    let resources: { slug: string; title: string; excerpt: string; tags: string[] }[] = [];
    let allTags: string[] = [];

    if (supabase) {
        const { data } = await supabase
            .from('resources')
            .select('slug, title, excerpt, tags, image_url')
            .eq('is_published', true)
            .order('published_at', { ascending: false });

        resources = (data || []).map(item => ({
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            tags: item.tags || [],
            imageUrl: item.image_url || undefined,
        }));

        allTags = Array.from(new Set(resources.flatMap(r => r.tags))).sort();
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            {/* Photo banner */}
            <div className="mb-8 aspect-[3/1] overflow-hidden rounded-lg bg-neutral-100 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1600&auto=format&fit=crop"
                    alt="Logistics Information Hub"
                    className="h-full w-full object-cover"
                />
            </div>
            <div className="mb-12">
                <h1 className="text-3xl font-bold text-neutral-900">Resources</h1>
                <p className="mt-4 text-neutral-600">
                    Reading instructions for export and customs requirements. Filter by
                    category to find relevant guides for your destination.
                </p>
            </div>
            <ResourcesList resources={resources} allTags={allTags} />
        </div>
    );
}
