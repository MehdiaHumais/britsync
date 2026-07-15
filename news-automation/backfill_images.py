import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load env
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_SCRIPT_DIR, ".env"))

# Import pipeline
sys.path.append(_SCRIPT_DIR)
from app.services.image_pipeline import ImagePipeline

db_url = os.getenv("POSTGRES_URL")
if not db_url:
    print("Error: POSTGRES_URL not found.")
    sys.exit(1)

pipeline = ImagePipeline()

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Map database 'section' column back to categories for the pipeline
section_to_cat = {
    "AI": "ai",
    "LIFESTYLE": "lifestyle",
    "WORLD_NEWS": "world"
}

query = """
    SELECT id, title, section, thumbnail 
    FROM "Article" 
    WHERE thumbnail IS NULL 
       OR thumbnail = '' 
       OR thumbnail LIKE '%fallback.webp%'
"""
cursor.execute(query)
articles = cursor.fetchall()

print(f"Found {len(articles)} articles to backfill.")

updated_count = 0
for art_id, title, section, thumbnail in articles:
    category = section_to_cat.get(section, "world")
    print(f"\nSearching image for: '{title[:60]}...' (Category: {category})")
    
    # Run pipeline to get image path (Wikimedia / APIs)
    image_path = pipeline.process_news(title, category)
    
    if image_path:
        cursor.execute("UPDATE \"Article\" SET thumbnail = %s WHERE id = %s", (image_path, art_id))
        print(f" -> UPDATED database thumbnail to: {image_path}")
        updated_count += 1
    else:
        # Set to NULL so it uses client-side blurred CSS
        cursor.execute("UPDATE \"Article\" SET thumbnail = NULL WHERE id = %s", (art_id,))
        print(" -> Set to NULL (will render dynamic CSS blur)")
        updated_count += 1

conn.commit()
cursor.close()
conn.close()

print(f"\nBackfill complete! Updated {updated_count} articles.")
