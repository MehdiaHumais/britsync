import sys
import os
import time
from datetime import datetime, timedelta
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import scraper, crud, database, models
from app.database import SessionLocal, engine
from app.config import FEEDS
from app.services.publisher import Publisher

def run_automation():
    print("Starting news automation...")
    db = SessionLocal()
    publisher = Publisher()

    models.Base.metadata.create_all(bind=engine)

    for category in FEEDS.keys():
        articles = scraper.fetch_rss_news(category)
        new_count = 0
        for article_data in articles:
            if not crud.article_exists(db, article_data["link"]):
                crud.create_article(db, article_data)
                print(f"    - Syncing to Website...", end="", flush=True)
                success = publisher.publish(article_data)
                if success:
                    print(" Success.")
                else:
                    print(" Failed (see error above).")
                new_count += 1
        print(f"  {category}: {len(articles)} fetched, {new_count} new and synced")

    db.close()
    print("Done.")

if __name__ == "__main__":
    print("=== News Automation Scheduler ===")
    print("Running first scrape now...")
    run_automation()
    while True:
        next_run = datetime.now() + timedelta(hours=4)
        print(f"\nNext scrape at: {next_run.strftime('%Y-%m-%d %H:%M:%S')}")
        print("Waiting 4 hours until next run...")
        time.sleep(14400)
        print(f"\n=== Running scheduled scrape: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
        run_automation()
