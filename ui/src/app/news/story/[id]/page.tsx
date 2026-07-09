import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import SafeImage from "@/components/safe-image";

const API_BASE = process.env.NEWS_API_URL || "http://127.0.0.1:8000";

function imageUrl(raw: string | null): string {
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    return `${API_BASE}/public${raw}`;
}

function extractDomain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let article: any = null;
    try {
        const res = await fetch(`${API_BASE}/article/${id}`, { cache: "no-store" });
        if (res.ok) {
            const json = await res.json();
            if (json.success) article = json.data;
        }
    } catch (err) {
        console.error(`StoryPage: fetch failed for article ${id}`, err);
    }

    if (!article) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="container mx-auto px-4 py-20 text-center">
                    <p className="text-stone-400 font-serif italic text-xl">Story not found.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="container mx-auto px-4 py-12 max-w-3xl">
                <div className="mb-8">
                    <Badge variant="outline" className="mb-4 uppercase tracking-[0.2em] text-stone-500 border-stone-300">
                        {article.category}
                    </Badge>
                    <h1 className="text-3xl md:text-5xl font-serif font-bold leading-tight mb-6">
                        {article.title}
                    </h1>
                    <p className="text-sm font-mono text-stone-400 uppercase">
                        {article.publish_date ? new Date(article.publish_date).toLocaleDateString() : "Live Report"}
                    </p>
                </div>
                <div className="aspect-video overflow-hidden mb-8">
                    <SafeImage
                        src={imageUrl(article.image_url)}
                        alt={article.title}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div
                    className="prose prose-stone max-w-none text-lg leading-relaxed [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-4 [&_strong]:font-bold [&_p]:mb-4 [&_p:first-child]:text-xl [&_p:first-child]:text-stone-600"
                    dangerouslySetInnerHTML={{ __html: article.summary || "No content available." }}
                />
                <div className="mt-12 pt-8 border-t border-stone-200 text-center">
                    <Link href="/news" className="text-sm font-bold uppercase tracking-widest border-b-2 border-stone-900 hover:border-stone-400 transition-all">
                        &larr; Back to News
                    </Link>
                </div>
            </main>
        </div>
    );
}
