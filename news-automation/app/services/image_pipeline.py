import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from PIL import Image
from io import BytesIO
import re
from datetime import datetime
from dotenv import load_dotenv

# Load .env from project root (parent of app/)
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_SCRIPT_DIR))
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))

# Default headers so image CDNs don't block us (403)
DEFAULT_HEADERS = {
    "User-Agent": "NewsAutomation/1.0 (https://www.britsyncai.com; backend news aggregator)",
    "Accept": "image/*,*/*",
}

class ImagePipeline:
    def __init__(self):
        self.unsplash_key = (os.getenv("UNSPLASH_ACCESS_KEY") or "").strip()
        self.pexels_key = (os.getenv("PEXELS_API_KEY") or "").strip()
        self.project_root = _PROJECT_ROOT
        
        # Override image directory if specified in .env (for Brit website connection)
        env_image_dir = os.getenv("IMAGE_OUTPUT_DIR")
        if env_image_dir:
            self.image_dir = env_image_dir
        else:
            self.image_dir = os.path.join(self.project_root, "public", "news-images")

        # Ensure base directory exists
        os.makedirs(self.image_dir, exist_ok=True)

        if not self.unsplash_key and not self.pexels_key:
            print("No image API keys in .env. Using fallback images.")

        # Session with retries and User-Agent (required by many image CDNs)
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def extract_keywords(self, title: str, category: str) -> str:
        """
        Extracts safe, generic keywords from the title and category.
        Removes special characters and stop words.
        """
        # basic stop words list
        stop_words = {
            "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", 
            "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "shallow",
            "should", "can", "could", "may", "might", "must", "news", "report", "update",
            "breaking", "exclusive", "interview", "review", "analysis", "opinion",
            "editorial", "column", "live", "video", "audio", "podcast", "gallery",
            "photos", "images", "pictures", "videos", "watch", "listen", "read",
            "click", "here", "more", "details", "full", "story", "article", "page",
            "site", "website", "web", "link", "url", "http", "https", "com", "net",
            "org", "gov", "edu", "mil", "int", "eu", "uk", "us", "ca", "au", "nz"
        }

        # Clean title: keep only alphanumeric and spaces
        clean_title = re.sub(r'[^a-zA-Z0-9\s]', '', title.lower())
        
        words = clean_title.split()
        keywords = [word for word in words if word not in stop_words and len(word) > 2]
        
        # Add category to keywords if not generic 'news'
        if category and category.lower() not in ["news", "general"]:
            keywords.insert(0, category.lower())

        result = " ".join(keywords[:5]).strip()
        # Ensure we never pass an empty query to APIs (they may reject or return nothing)
        if not result:
            result = category if category else "news"
        return result

    def search_images(self, query: str) -> list[str]:
        """
        Searches for copyright-free images: Unsplash (primary), Pexels (fallback).
        Returns a list of image URLs to download and store locally.
        """
        query = (query or "news").strip()
        image_urls = []

        # Primary: Unsplash
        if self.unsplash_key:
            try:
                url = f"https://api.unsplash.com/search/photos?query={query}&per_page=5&orientation=landscape&client_id={self.unsplash_key}"
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for result in data.get("results", []):
                        urls = result.get("urls") or {}
                        if urls.get("regular"):
                            image_urls.append(urls["regular"])
                    if not image_urls:
                        print(f"  Unsplash: no results for '{query}'")
                else:
                    print(f"  Unsplash: API error {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"  Unsplash: {e}")
            except (KeyError, TypeError) as e:
                print(f"  Unsplash: unexpected response - {e}")

        # Fallback: Pexels (only if Unsplash fails or returns nothing)
        if not image_urls and self.pexels_key:
            try:
                url = f"https://api.pexels.com/v1/search?query={query}&per_page=5&orientation=landscape"
                headers = {"Authorization": self.pexels_key}
                response = self.session.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for photo in data.get("photos", []):
                        src = (photo.get("src") or {}).get("large")
                        if src:
                            image_urls.append(src)
                    if not image_urls:
                        print(f"  Pexels: no results for '{query}'")
                else:
                    print(f"  Pexels: API error {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"  Pexels: {e}")
            except (KeyError, TypeError) as e:
                print(f"  Pexels: unexpected response - {e}")

        # Keyless Fallback 1: Wikipedia Page Images (highly relevant concept images)
        if not image_urls:
            image_urls = self.search_wikipedia(query)

        # Keyless Fallback 2: Wikimedia Commons
        if not image_urls:
            image_urls = self.search_wikimedia(query)

        return image_urls

    def search_wikipedia(self, query: str) -> list[str]:
        """
        Searches English Wikipedia for page articles matching the query,
        and retrieves the original page image if it exists.
        Returns a list containing the image URL if found, or empty list.
        """
        query = (query or "news").strip()
        print(f"  [WIKIPEDIA] Searching Wikipedia for: '{query}'")
        search_url = "https://en.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": 1
        }
        
        try:
            resp = self.session.get(search_url, params=search_params, timeout=10)
            if resp.status_code == 200:
                results = resp.json().get("query", {}).get("search", [])
                if results:
                    page_title = results[0]["title"]
                    # Get page image URL
                    image_params = {
                        "action": "query",
                        "prop": "pageimages",
                        "piprop": "original",
                        "titles": page_title,
                        "format": "json"
                    }
                    resp2 = self.session.get(search_url, params=image_params, timeout=10)
                    if resp2.status_code == 200:
                        pages = resp2.json().get("query", {}).get("pages", {})
                        for page_id, page in pages.items():
                            original = page.get("original", {})
                            img_url = original.get("source")
                            if img_url:
                                return [img_url]
        except Exception as e:
            print(f"  Wikipedia search failed: {e}")
            
        return []

    def search_wikimedia(self, query: str) -> list[str]:
        """
        Searches Wikimedia Commons using its keyless public MediaWiki API.
        Returns a list of image URLs.
        """
        query = (query or "news").strip()
        print(f"  [WIKIMEDIA] Searching Commons for: '{query}'")
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"filetype:bitmap {query}",
            "gsrnamespace": 6, # File namespace
            "gsrlimit": 5,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 800
        }
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                pages = data.get("query", {}).get("pages", {})
                urls = []
                for page_id, page in pages.items():
                    imageinfo = page.get("imageinfo", [])
                    if imageinfo:
                        img_url = imageinfo[0].get("thumburl") or imageinfo[0].get("url")
                        if img_url:
                            urls.append(img_url)
                return urls
            else:
                print(f"  Wikimedia: API error {response.status_code}")
        except Exception as e:
            print(f"  Wikimedia search failed: {e}")
            
        return []

    def download_and_optimize(self, url: str, save_path: str) -> bool:
        """
        Downloads an image from the URL, optimizes it (WEBP), and saves it to save_path.
        Uses session headers (User-Agent) so CDNs don't return 403.
        """
        try:
            response = self.session.get(url, timeout=15)
            if response.status_code != 200:
                print(f"  Download failed: HTTP {response.status_code}")
                return False

            image_data = BytesIO(response.content)
            img = Image.open(image_data)

            # Convert to RGB if necessary (e.g. for PNGs with transparency)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Resize if too large (max width 1200px)
            max_width = 1200
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)

            # Save as WEBP
            img.save(save_path, "WEBP", quality=80)
            print(f"  Saved: {os.path.basename(save_path)}")
            return True
        except Exception as e:
            print(f"  Image failed: {e}")
            return False

    def _get_fallback_image(self) -> str:
        """Returns the path to a fallback image."""
        # Create a simple colored placeholder if not exists
        fallback_path = os.path.join(self.image_dir, "fallback.webp")
        if not os.path.exists(fallback_path):
             # Create a dark slate blue background
             img = Image.new('RGB', (800, 600), color = (47, 79, 79))
             
             try:
                 from PIL import ImageDraw, ImageFont
                 draw = ImageDraw.Draw(img)
                 # Try to load a font, otherwise use default
                 try:
                     # Attempt to use a standard font usually available
                     font = ImageFont.truetype("arial.ttf", 60)
                 except IOError:
                     font = ImageFont.load_default()
                 
                 text = "No Image Available"
                 
                 # Calculate text position to center it
                 # ImageDraw.textbbox is available in newer Pillow versions, fallback to textsize if needed
                 try:
                     left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
                     text_width = right - left
                     text_height = bottom - top
                 except AttributeError:
                     text_width, text_height = draw.textsize(text, font=font)
                 
                 position = ((800 - text_width) / 2, (600 - text_height) / 2)
                 draw.text(position, text, fill=(200, 200, 200), font=font)
                 
             except Exception as e:
                 print(f"  Fallback: could not add text - {e}")

             img.save(fallback_path, "WEBP")
        
        # Relative path for DB (use project_root-aware path)
        # Note: Next.js serves files from public/ directly, so we just use /news-images/...
        return os.path.join("/", "news-images", "fallback.webp").replace("\\", "/")

    def process_news(self, title: str, category: str) -> str:
        """
        Main method to process a news item.
        1. Extract keywords
        2. Search images
        3. Download & Optimize
        4. Return local path
        """
        
        # 1. Generate path (use project root, not cwd, so it works from any directory)
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        slug = re.sub(r'[^a-zA-Z0-9]', '-', title.lower()).strip('-')  # basic slugify
        if len(slug) > 100:
            slug = slug[:100].rstrip('-')
        filename = f"{slug}.webp"

        # Relative path (for DB storage - omit 'public' for Next.js)
        relative_db_path = os.path.join("news-images", year, month, filename)
        
        # Path for file system operations
        abs_save_path = os.path.join(self.image_dir, year, month, filename)

        # Return existing file if it already exists (avoid re-downloading)
        if os.path.exists(abs_save_path):
            return os.path.join("/", relative_db_path).replace("\\", "/")

        # 2. Extract keywords
        keywords = self.extract_keywords(title, category)
        print(f"Searching images for '{title[:60]}...'")

        # 3. Search images
        image_urls = self.search_images(keywords)

        if image_urls:
            # 4. Try downloading the first valid one
            for url in image_urls:
                if self.download_and_optimize(url, abs_save_path):
                    # Return web-accessible relative path for DB
                    return os.path.join("/", relative_db_path).replace("\\", "/")
            print(f"  All downloads failed, using fallback.")

        # 5. Fallback
        print(f"Using dynamic CSS fallback placeholder on website.")
        return None

