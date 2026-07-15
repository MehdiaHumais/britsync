import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import SafeImage from "@/components/safe-image";
import { prisma } from "@/lib/db";

interface SectionContentProps {
    dataSection: string;
    displayTitle: string;
}

export default async function SectionContent({ dataSection, displayTitle }: SectionContentProps) {
    let articles: any[] = [];

    try {
        articles = await prisma.article.findMany({
            where: {
                section: dataSection
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 50
        });
    } catch (err) {
        console.error(`SectionContent (${dataSection}): DB query failed.`, err);
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="container mx-auto px-4 py-12">
                <div className="mb-12 text-center">
                    <Badge variant="outline" className="mb-4 uppercase tracking-[0.2em] text-stone-500 border-stone-300">
                        Section
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight">
                        {displayTitle}
                    </h1>
                </div>

                {articles.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article) => (
                            <Link key={article.id} href={`/article/${article.slug}`} className="border border-stone-200 p-6 flex flex-col group hover:shadow-2xl transition-shadow bg-white">
                                <div className="relative mb-6 overflow-hidden aspect-video block bg-stone-100 border border-stone-100">
                                    <SafeImage
                                        src={article.thumbnail || ""}
                                        alt={article.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                </div>
                                <h3 className="text-2xl font-serif font-bold mb-4 flex-1 leading-tight group-hover:text-stone-600 transition-colors">
                                    {article.title}
                                </h3>
                                <p className="text-stone-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
                                    {article.content ? article.content.replace(/<[^>]*>/g, "").trim().slice(0, 200) : article.title}
                                </p>
                                <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                                    <span className="text-xs font-mono text-stone-400 uppercase">
                                        {article.createdAt ? new Date(article.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : "Live Report"}
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
                        <p className="text-stone-400 font-serif italic mb-4">No news available in {displayTitle} at the moment.</p>
                        <Link href="/">
                            <button className="px-6 py-2 bg-stone-900 text-white rounded-full uppercase tracking-widest text-[10px] font-bold">Return Home</button>
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
