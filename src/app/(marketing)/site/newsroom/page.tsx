import type { Metadata } from "next";
import NewsCard from "@/components/marketing/NewsCard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
    title: "Newsroom",
    description:
        "Advanced Export & Logistics Solutions",
};

export const dynamic = 'force-dynamic';

export default async function NewsroomPage() {
    const supabase = getSupabaseServerClient();
    let articles: { slug: string; title: string; date: string; excerpt: string; imageUrl?: string; pinned?: boolean }[] = [];

    if (supabase) {
        const { data } = await supabase
            .from('news_articles')
            .select('slug, title, excerpt, image_url, is_pinned, published_at')
            .eq('is_published', true)
            .order('is_pinned', { ascending: false })
            .order('published_at', { ascending: false });

        articles = (data || []).map(item => ({
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            date: item.published_at || '',
            imageUrl: item.image_url || undefined,
            pinned: item.is_pinned,
        }));
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            {/* Photo banner */}
            <div className="mb-8 aspect-[21/9] overflow-hidden rounded-xl bg-neutral-100 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/images/newsroom-hero.jpg"
                    alt="Logistics Industry News"
                    className="h-full w-full object-cover"
                />
            </div>
            <div className="mb-12">
                <h1 className="text-3xl font-bold text-neutral-900">Newsroom</h1>
                <p className="mt-4 text-neutral-600">
                    Company announcements, route updates, and logistics industry news.
                </p>
            </div>
            <div className="space-y-8">
                {articles.length === 0 ? (
                    <p className="text-center text-neutral-400 py-8">No articles published yet.</p>
                ) : (
                    articles.map((item) => (
                        <NewsCard key={item.slug} {...item} />
                    ))
                )}
            </div>
        </div>
    );
}
