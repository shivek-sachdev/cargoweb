import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const supabase = getSupabaseServerClient();
    if (!supabase) return {};
    const { data: item } = await supabase
        .from('news_articles')
        .select('title, excerpt')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
    if (!item) return {};
    return {
        title: item.title,
        description: item.excerpt,
    };
}

export default async function NewsroomArticlePage({ params }: PageProps) {
    const { slug } = await params;
    const supabase = getSupabaseServerClient();
    if (!supabase) notFound();

    const { data: item } = await supabase
        .from('news_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

    if (!item) notFound();

    const formattedDate = item.published_at
        ? new Date(item.published_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : '';

    return (
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-2">
                <Link
                    href="/site/newsroom"
                    className="inline-flex w-fit items-center text-sm font-medium transition hover:opacity-80"
                    style={{ color: "var(--color-primary-ref)" }}
                >
                    <svg
                        className="mr-2 h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    Back to Newsroom
                </Link>
                {formattedDate && (
                    <time
                        dateTime={item.published_at}
                        className="block text-sm font-medium"
                        style={{ color: "var(--color-primary-ref)" }}
                    >
                        {formattedDate}
                    </time>
                )}
            </div>
            {item.image_url && (
                <div className="mb-8 aspect-[16/9] overflow-hidden rounded-xl bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                </div>
            )}
            <h1 className="text-3xl font-bold leading-tight text-neutral-900">{item.title}</h1>
            <div className="prose prose-neutral mt-8 max-w-none">
                <p className="text-lg leading-relaxed text-neutral-600">{item.excerpt}</p>
                {item.content && (
                    <div className="mt-6 whitespace-pre-wrap text-neutral-600 leading-relaxed">
                        {item.content}
                    </div>
                )}
            </div>
        </article>
    );
}
