export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Article } from "@prisma/client";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/safe-image";

export default async function Home() {
  let allArticles: Article[] = [];
  try {
    // Fetch all recent articles to avoid query mismatches and ensure freshness
    allArticles = await prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      take: 50, // Get enough to fill all sections
    });
  } catch (err) {
    console.error("Home: News DB access failed. Working in resilient mode.", err);
  }

  // Filter manually to be absolutely sure of matches
  const aiArticles = allArticles.filter(a => a.section.trim().toUpperCase() === "AI").slice(0, 6);
  const lifestyleArticles = allArticles.filter(a => a.section.trim().toUpperCase() === "LIFESTYLE").slice(0, 4);
  const worldNews = allArticles.filter(a => a.section.trim().toUpperCase() === "WORLD_NEWS").slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* --- AI SECTION (NOW FIRST) --- */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Badge className="mb-4 bg-stone-900 text-stone-100 uppercase tracking-widest text-[10px]">AI & Technology</Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold">Intelligent Future.</h2>
            </div>
            <Link href="/ai" className="text-sm font-bold uppercase tracking-widest border-b-2 border-transparent hover:border-stone-900 transition-all">
              Explore All AI
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {aiArticles.length > 0 ? (
              aiArticles.map((article: Article) => (
                <div key={article.id} className="border border-stone-200 p-6 flex flex-col group hover:shadow-2xl transition-shadow bg-white">
                  <Link href={`/article/${article.slug}`} className="block relative mb-6 overflow-hidden aspect-video bg-stone-100">
                    <SafeImage src={article.thumbnail || ""} alt={article.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    {article.isPremium && (
                      <div className="absolute top-4 right-4 bg-stone-900 text-white text-[10px] uppercase font-bold px-3 py-1 tracking-widest">
                        Premium
                      </div>
                    )}
                  </Link>
                  <Link href={`/article/${article.slug}`}>
                    <h3 className="text-2xl font-serif font-bold mb-4 flex-1 leading-tight hover:text-stone-600 transition-colors">
                      {article.title}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                    <span className="text-xs font-mono text-stone-400">
                      {new Date(article.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                    </span>
                    <Link href={`/article/${article.slug}`}>
                      <Button variant="ghost" size="sm" className="font-serif italic text-stone-900 group-hover:translate-x-1 transition-transform">
                        Read Tutorial &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-20 border border-dashed border-stone-200">
                <p className="text-stone-400 font-serif italic">No AI technical reports found in section 'AI'.</p>
              </div>
            )}
          </div>
        </section>

        <hr className="mb-20 border-stone-200" />

        {/* --- LIFESTYLE SECTION (NOW SECOND) --- */}
        <section className="mb-20">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-12 mb-8 text-center">
              <Badge variant="outline" className="mb-4 uppercase tracking-[0.2em] text-stone-500 border-stone-300">
                Premium Lifestyle
              </Badge>
              <h2 className="text-4xl md:text-6xl lg:text-8xl font-serif font-bold tracking-tight mb-8">
                The Art of Modern Living.
              </h2>
            </div>

            {lifestyleArticles.length > 0 ? (
              <>
                <div className="lg:col-span-8 group relative overflow-hidden bg-stone-100">
                  <SafeImage
                    src={lifestyleArticles[0].thumbnail || ""}
                    alt={lifestyleArticles[0].title}
                    className="w-full h-[600px] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500 flex flex-col justify-end p-8 text-white">
                    <Badge className="w-fit mb-4 bg-white text-black hover:bg-white uppercase tracking-widest text-[10px]">Lifestyle</Badge>
                    <h3 className="text-3xl md:text-5xl font-serif font-bold mb-4 max-w-2xl leading-tight">
                      {lifestyleArticles[0].title}
                    </h3>
                    <Link href={`/article/${lifestyleArticles[0].slug}`}>
                      <Button variant="outline" className="text-white border-white hover:bg-white hover:text-black rounded-full font-serif italic text-lg px-8">
                        Read the Story
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-8">
                  {lifestyleArticles.slice(1).map((article: Article) => (
                    <div key={article.id} className="grid grid-cols-3 gap-4 border-b border-stone-200 pb-8 last:border-0 group">
                      <Link href={`/article/${article.slug}`} className="col-span-1 overflow-hidden h-24 block bg-stone-100">
                        <SafeImage src={article.thumbnail || ""} alt={article.title} className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-110" />
                      </Link>
                      <div className="col-span-2">
                        <Link href={`/article/${article.slug}`}>
                          <h4 className="font-serif font-bold text-lg leading-tight mb-2 hover:text-stone-600 transition-colors">
                            {article.title}
                          </h4>
                        </Link>
                        <Link href={`/article/${article.slug}`} className="text-xs uppercase tracking-widest text-stone-400 font-bold hover:text-stone-900 transition-colors">
                          View Feature
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="lg:col-span-12 text-center py-20 border border-dashed border-stone-200">
                <p className="text-stone-400 font-serif italic">No lifestyle features available at the moment.</p>
              </div>
            )}
          </div>
        </section>

        <hr className="mb-20 border-stone-200" />

        {/* --- WORLD NEWS FEED (THIRD) --- */}
        <section className="mb-20 bg-stone-100 p-8 md:p-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-3xl font-serif font-bold flex items-center gap-4">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                World News Feed
              </h2>
              <Link href="/news" className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-900 border-b border-stone-900 pb-1 hover:text-red-600 hover:border-red-600 transition-colors">
                Explore All News
              </Link>
            </div>
            <div className="flex flex-col gap-8">
              {worldNews.length > 0 ? (
                worldNews.map((article: Article) => (
                  <div key={article.id} className="flex flex-col md:flex-row gap-8 group hover:translate-x-2 transition-all p-4 hover:bg-white/50 border-b border-stone-200 last:border-0">
                    <Link href={`/article/${article.slug}`} className="md:w-48 shrink-0 block">
                      <div className="overflow-hidden aspect-video md:aspect-square rounded-none border border-stone-200">
                        <SafeImage src={article.thumbnail || ""} alt={article.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      </div>
                    </Link>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">
                          {article.createdAt ? new Date(article.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "08:45 AM"}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-stone-300" />
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Live Report</span>
                      </div>

                      <Link href={`/article/${article.slug}`}>
                        <h3 className="text-xl font-serif font-bold mb-3 hover:text-red-700 transition-colors leading-tight">
                          {article.title}
                        </h3>
                      </Link>

                      <div
                        className="text-stone-500 text-sm leading-relaxed mb-4 line-clamp-2 italic"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                      />

                      <Link href={`/article/${article.slug}`} className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-900 flex items-center gap-2 group-hover:underline">
                        Read Investigation <span className="text-red-600">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-stone-500 italic font-serif text-center">No breaking news at this hour.</p>
              )}
            </div>
            <Button className="w-full mt-12 bg-transparent border border-stone-300 text-stone-900 hover:bg-stone-900 hover:text-white rounded-none h-14 uppercase tracking-widest font-bold text-xs transition-colors">
              Load More Breaking News
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-16 bg-white">
        <div className="container mx-auto px-4 grid md:grid-cols-4 gap-12 text-center md:text-left">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-serif font-bold mb-6">Zyphra</h1>
            <p className="text-stone-500 max-w-sm mb-8">
              A premium digital newspaper platform dedicated to high-quality journalism, tech tutorials, and curated lifestyle content.
            </p>
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div className="h-10 w-10 rounded-full border border-stone-200 flex items-center justify-center font-serif italic">T</div>
              <div className="h-10 w-10 rounded-full border border-stone-200 flex items-center justify-center font-serif italic">I</div>
              <div className="h-10 w-10 rounded-full border border-stone-200 flex items-center justify-center font-serif italic">X</div>
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Sections</h4>
            <ul className="flex flex-col gap-4 text-stone-500 text-sm font-medium">
              <li><Link href="/news">World News</Link></li>
              <li><Link href="/ai">AI & Technology</Link></li>
              <li><Link href="/lifestyle">Lifestyle</Link></li>
              <li><Link href="/tutorials">Tutorials</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Company</h4>
            <ul className="flex flex-col gap-4 text-stone-500 text-sm font-medium">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/subscribe">Membership</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-16 pt-8 border-t border-stone-100 text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
          &copy; 2026 Zyphra Digital Group. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
