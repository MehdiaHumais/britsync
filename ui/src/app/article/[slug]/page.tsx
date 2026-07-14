export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Navbar } from "@/components/navbar";
import { Paywall } from "@/components/paywall";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { Calendar, Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { TimerPaywall } from "@/components/timer-paywall";
import { ArticleActions } from "@/components/article-actions";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug: rawSlug } = await params;
    const slug = decodeURIComponent(rawSlug);

    // Try finding the article with precise slug
    let article = await prisma.article.findUnique({
        where: { slug }
    });

    // Fallback search if unique slug fails (handles mysterious encoding issues)
    if (!article) {
        article = await prisma.article.findFirst({
            where: {
                OR: [
                    { slug: rawSlug },
                    { slug: slug.toLowerCase() },
                ]
            }
        });
    }

    if (!article) {
        return notFound();
    }

    // Calculate word count and read time
    const wordCount = article.content ? article.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    // Format date
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date(article.createdAt));

    // Check Access
    const session = await getSession();
    let hasAccess = false;

    if (session) {
        const subscriptions = await prisma.subscription.findMany({
            where: {
                userId: session.id,
                isActive: true
            }
        });

        const subSections = subscriptions.map((s: { section: string }) => s.section);
        if (subSections.includes("ALL") || subSections.includes(article.section)) {
            hasAccess = true;
        }
    }

    const showPaywall = article.isPremium && !hasAccess;

    return (
        <div className="min-h-screen flex flex-col bg-white">
            <Navbar />

            <main className="flex-1">
                <article className="max-w-4xl mx-auto px-4 py-12 md:py-20">
                    <header className="mb-12 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-8">
                            <Badge variant="outline" className="uppercase tracking-[0.2em] text-[10px] py-1">
                                {article.section}
                            </Badge>
                            {article.isPremium && (
                                <Badge className="bg-stone-900 text-white uppercase tracking-[0.2em] text-[10px] py-1 hover:bg-stone-900">
                                    Premium
                                </Badge>
                            )}
                        </div>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight mb-8 leading-[1.1]">
                            {article.title}
                        </h1>

                        <div className="flex flex-col md:flex-row md:items-center gap-6 py-8 border-y border-stone-100 mb-12">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center font-serif italic text-xl">
                                    C
                                </div>
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-widest text-stone-900">The Editorial Staff</p>
                                    <p className="text-xs text-stone-400 font-medium">Senior Correspondent</p>
                                </div>
                            </div>
                            <div className="hidden md:block w-[1px] h-10 bg-stone-100" />
                            <div className="flex items-center gap-6 text-stone-400 text-xs font-bold uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>{readTime} Min Read</span>
                                </div>
                            </div>
                            <div className="flex-1 flex justify-end gap-4">
                                <ArticleActions
                                    articleId={article.id}
                                    articleTitle={article.title}
                                    articleSlug={article.slug}
                                />
                            </div>
                        </div>
                    </header>

                    <div className="aspect-[21/9] mb-16 overflow-hidden bg-stone-100">
                        <img
                            src={article.thumbnail || ""}
                            alt={article.title}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <div className="relative">
                        {/* Article Content with Typography */}
                        <div className="rich-text max-w-none">
                            {article.content && article.content.length > 5 ? (
                                <div dangerouslySetInnerHTML={{ __html: article.content }} />
                            ) : (
                                <div className="py-12 border-y border-stone-100 italic text-stone-500">
                                    <p>The full report for this story is currently being updated by our editorial team. Please check back shortly for the complete analysis.</p>
                                    <p className="mt-4 font-bold text-stone-900 not-italic">Summary: {article.title}</p>
                                </div>
                            )}
                        </div>

                        {/* Video Embed (Fallback if not embedded in content) */}
                        {article.videoUrl && article.content && !article.content.includes("youtube-video") && (
                            <div className="my-12 aspect-video bg-black rounded-lg overflow-hidden relative group">
                                {article.videoUrl.includes("youtube") || article.videoUrl.includes("youtu.be") ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${article.videoUrl.split('v=')[1]?.split('&')[0] || article.videoUrl.split('/').pop()}`}
                                        title="Video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-stone-500 font-mono text-xs">
                                        Video format not supported yet ({article.videoUrl})
                                    </div>
                                )}
                            </div>
                        )}

                        {article.editorsNote && (
                            <div className="mt-12 p-8 bg-stone-50 border border-stone-100 rounded-lg">
                                <h3 className="font-bold uppercase tracking-widest text-xs mb-4 text-stone-900">Editor's Note</h3>
                                <p className="text-sm text-stone-600 leading-relaxed font-serif italic whitespace-pre-line">
                                    {article.editorsNote}
                                </p>
                            </div>
                        )}

                        {/* The TimerPaywall handles both the 1-min preview and the 24h block logic */}
                        <TimerPaywall section={article.section} isPremium={article.isPremium} hasAccess={hasAccess} />
                    </div>
                </article>

                {/* --- NEWSLETTER FOOTER --- */}
                <section className="bg-stone-900 py-32 text-stone-100 overflow-hidden relative">
                    <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
                        <h2 className="text-5xl md:text-7xl font-serif font-bold mb-8">Stay Ahead of the Curve</h2>
                        <p className="text-stone-400 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
                            Get the morning's top stories, technical breakthroughs, and lifestyle inspiration delivered directly to your inbox.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="flex-1 bg-transparent border-b-2 border-stone-700 py-4 px-2 focus:outline-none focus:border-stone-100 transition-colors font-serif italic text-xl"
                            />
                            <Button className="bg-white text-black hover:bg-stone-200 rounded-none h-14 px-12 font-bold uppercase tracking-widest text-xs">
                                Subscribe
                            </Button>
                        </div>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-64 h-64 border-r border-b border-stone-800" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 border-l border-t border-stone-800" />
                </section>
            </main>
        </div >
    );
}
