import Link from "next/link";
import { Search, Menu, User, LogOut, ArrowLeft, Globe, Cpu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { PremiumNav } from "./premium-nav";

export async function Navbar() {
    const session = await getSession();
    const breakingNews = "Global Summit Reaches Historic Agreement on Climate Action • New Space Mission to Mars Announced for 2030 • Tech Giant Unveils Revolutionary AGI Model •";

    return (
        <div className="flex flex-col">
            {/* Top Non-Sticky Breaking News Bar (RESTORED BLACK) */}
            <div className="bg-stone-900 text-stone-100 py-3 overflow-hidden whitespace-nowrap border-b border-white/10">
                <div className="container mx-auto px-4 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <span className="text-red-500 shrink-0">Breaking News:</span>
                    <div className="animate-marquee inline-block">
                        {breakingNews}
                    </div>
                </div>
            </div>

            <header className="border-b border-stone-200 bg-white sticky top-0 z-50">
                <div className="container mx-auto px-4">
                    {/* Primary Row: Logo & Actions */}
                    <div className="flex items-center justify-between h-20 border-b border-stone-100 lg:border-none">
                        <div className="flex items-center h-full">
                            <Button variant="ghost" size="icon" className="lg:hidden mr-4">
                                <Menu className="h-6 w-6" />
                            </Button>

                            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-stone-50 border border-stone-200 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Live Portal</span>
                            </div>
                        </div>

                        <Link href="/" className="flex items-center gap-2 group">
                            <h1 className="text-3xl font-serif font-black tracking-tighter">
                                <span className="text-stone-400 group-hover:text-stone-900 transition-colors">The</span> <span className="italic">Zyphra</span>
                            </h1>
                        </Link>

                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon">
                                <Search className="h-5 w-5 text-stone-500" />
                            </Button>
                            <div className="h-6 w-[1px] bg-stone-200 hidden sm:block" />

                            {!session ? (
                                <Link href="/subscribe">
                                    <Button variant="outline" className="hidden sm:flex rounded-full border-stone-300 font-serif italic">
                                        Subscribe
                                    </Button>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <Link href="/profile">
                                        <Button variant="ghost" size="icon" title="Profile">
                                            <User className="h-5 w-5 text-stone-900" />
                                        </Button>
                                    </Link>
                                    <form action="/api/auth/logout" method="POST">
                                        <Button type="submit" variant="ghost" size="icon" title="Logout">
                                            <LogOut className="h-5 w-5 text-red-500" />
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Secondary Row: Categories (Desktop/Laptop Only) */}
                    <nav className="hidden lg:flex items-center justify-center gap-8 h-12 border-t border-stone-50">
                        <Link 
                           href="https://britsync.co.uk" 
                           className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600 hover:text-cyan-700 transition-colors"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            Back to BritSync
                        </Link>
                        <div className="w-[1px] h-3 bg-stone-200" />
                        
                        <Link href="/news" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors">
                            <Globe className="w-3 h-3" />
                            World News
                        </Link>
                        <Link href="/ai" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors">
                            <Cpu className="w-3 h-3" />
                            AI & Technology
                        </Link>
                        <Link href="/lifestyle" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors">
                            <Sparkles className="w-3 h-3" />
                            Lifestyle
                        </Link>
                        <Link href="/archive" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors">
                            <Search className="w-3 h-3" />
                            Full Archive
                        </Link>
                    </nav>
                </div>
            </header>
        </div>
    );
}
