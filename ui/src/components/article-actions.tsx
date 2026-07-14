"use client";

import { useState, useEffect } from "react";
import { Share2, Bookmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArticleActionsProps {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
}

export function ArticleActions({ articleId, articleTitle, articleSlug }: ArticleActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    // Check if bookmarked in localStorage on mount
    const saved = localStorage.getItem("saved_articles");
    if (saved) {
      try {
        const list = JSON.parse(saved) as string[];
        setIsBookmarked(list.includes(articleId));
      } catch (e) {
        console.error(e);
      }
    }
  }, [articleId]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/article/${encodeURIComponent(articleSlug)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: articleTitle,
          url: shareUrl,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleBookmark = () => {
    const saved = localStorage.getItem("saved_articles");
    let list: string[] = [];
    if (saved) {
      try {
        list = JSON.parse(saved) as string[];
      } catch (e) {
        console.error(e);
      }
    }

    if (list.includes(articleId)) {
      list = list.filter((id) => id !== articleId);
      setIsBookmarked(false);
    } else {
      list.push(articleId);
      setIsBookmarked(true);
    }

    localStorage.setItem("saved_articles", JSON.stringify(list));
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="rounded-full flex items-center gap-2 border-stone-200 hover:border-stone-400 text-stone-700 hover:text-stone-900 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Copied</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Share</span>
          </>
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleBookmark}
        className={`rounded-full flex items-center gap-2 border-stone-200 hover:border-stone-400 transition-colors ${
          isBookmarked
            ? "bg-stone-900 text-white hover:bg-stone-800 hover:text-white border-stone-900"
            : "text-stone-700 hover:text-stone-900"
        }`}
      >
        <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`} />
        <span className="text-xs font-bold uppercase tracking-wider">
          {isBookmarked ? "Saved" : "Save"}
        </span>
      </Button>
    </div>
  );
}
