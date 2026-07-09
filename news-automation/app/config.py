# RSS Feed URLs for different categories
# Using feeds with proper article summaries (not Google News which blocks access)
FEEDS = {
    "ai": "https://techcrunch.com/category/artificial-intelligence/feed/",
    "lifestyle": "https://www.theguardian.com/lifeandstyle/rss",
    "world": "https://feeds.bbci.co.uk/news/world/rss.xml"
}

# User-Agent for requests to avoid being blocked
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

# Map automation categories to database section names
SECTION_MAPPING = {
    "ai": "AI",
    "lifestyle": "LIFESTYLE",
    "world": "WORLD_NEWS"
}

# Limit the number of articles to fetch per category per run
# This prevents the daily run from taking hours when using slow local AI
MAX_ARTICLES_LIMIT = 5
