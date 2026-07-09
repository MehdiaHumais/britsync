import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import SafeImage from "@/components/safe-image";

interface NewsArticle {
    id: number;
    title: string;
    summary: string;
    link: string;
    publish_date: string;
    category: string;
    image_url: string | null;
}

const CATEGORIES = [
    { id: "ai", label: "AI", emoji: "🤖" },
    { id: "lifestyle", label: "Lifestyle", emoji: "🌿" },
    { id: "world", label: "World News", emoji: "🌍" },
];

const API_BASE = process.env.NEWS_API_URL || "http://127.0.0.1:8000";

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
}

function imageUrl(raw: string | null): string {
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    return `${API_BASE}/public${raw}`;
}

export const dynamic = "force-dynamic";

export default async function NewsPage({
    searchParams,
}: {
    searchParams: Promise<{ cat?: string }>;
}) {
    const { cat } = await searchParams;
    const activeCat = cat || "world";

    let articles: NewsArticle[] = [];
    try {
        const res = await fetch(`${API_BASE}/news/${activeCat}`, { cache: "no-store" });
        if (res.ok) {
            articles = await res.json();
        }
    } catch (err) {
        console.error(`NewsPage: FastAPI fetch failed for ${activeCat}`, err);
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="container mx-auto px-4 py-12">
                <div className="mb-12 text-center">
                    <Badge variant="outline" className="mb-4 uppercase tracking-[0.2em] text-stone-500 border-stone-300">
                        BritSync News
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight">
                        Latest Stories
                    </h1>
                </div>

                {/* Category Tabs */}
                <div className="flex justify-center gap-4 mb-12 flex-wrap">
                    {CATEGORIES.map((c) => {
                        const isActive = activeCat === c.id;
                        return (
                            <a
                                key={c.id}
                                href={`?cat=${c.id}`}
                                className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${
                                    isActive
                                        ? "bg-stone-900 text-white"
                                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                }`}
                            >
                                {c.emoji} {c.label}
                            </a>
                        );
                    })}
                </div>

                {articles.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article) => (
                            <Link key={article.id} href={`/news/story/${article.id}`} className="border border-stone-200 p-6 flex flex-col group hover:shadow-2xl transition-shadow bg-white">
                                <div className="relative mb-6 overflow-hidden aspect-video block">
                                    <SafeImage
                                        src={imageUrl(article.image_url)}
                                        alt={article.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                </div>
                                <h3 className="text-2xl font-serif font-bold mb-4 flex-1 leading-tight group-hover:text-stone-600 transition-colors">
                                    {article.title}
                                </h3>
                                <p className="text-stone-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
                                    {stripHtml(article.summary || stripHtml(article.title)).slice(0, 200)}
                                </p>
                                <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                                    <span className="text-xs font-mono text-stone-400 uppercase">
                                        {article.publish_date ? new Date(article.publish_date).toLocaleDateString() : "Live Report"}
                                    </span>
                                    <span className="font-serif italic text-stone-900 text-sm group-hover:translate-x-1 transition-transform">
                                        Read Story &rarr;
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border border-dashed border-stone-200">
                        <p className="text-stone-400 font-serif italic mb-4">No news available in this category at the moment.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
