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
        .from('resources')
        .select('title, excerpt')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
    if (!item) return {};
    return {
        title: item.title,
        description: item.excerpt,
        openGraph: {
            title: item.title,
            description: item.excerpt,
        },
    };
}

export default async function ResourceArticlePage({ params }: PageProps) {
    const { slug } = await params;
    const supabase = getSupabaseServerClient();
    if (!supabase) notFound();

    const { data: item } = await supabase
        .from('resources')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

    if (!item) notFound();

    return (
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <Link
                href="/site/resources"
                className="mb-8 inline-flex items-center text-sm font-medium transition hover:opacity-80"
                style={{ color: "var(--color-primary-ref)" }}
            >
                <svg
                    className="mr-2 h-4 w-4"
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
                Back to Resources
            </Link>
            <div className="flex flex-wrap gap-2">
                {(item.tags || []).map((tag: string) => (
                    <span
                        key={tag}
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                            backgroundColor: "var(--color-primary-ref)",
                            color: "white",
                        }}
                    >
                        {tag}
                    </span>
                ))}
            </div>
            {item.image_url && (
                <div className="mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-neutral-100 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                    />
                </div>
            )}
            <h1 className="mt-4 text-3xl font-bold text-neutral-900">{item.title}</h1>
            <div className="prose prose-neutral mt-8 max-w-none">
                <p className="text-lg text-neutral-600">{item.excerpt}</p>
                {item.content && (
                    <div className="mt-6 whitespace-pre-wrap text-neutral-600 leading-relaxed">
                        {item.content}
                    </div>
                )}
                {item.file_url && (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                        <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium"
                            style={{ color: "var(--color-primary-ref)" }}
                        >
                            📄 Download Document
                        </a>
                    </div>
                )}
            </div>
        </article>
    );
}
