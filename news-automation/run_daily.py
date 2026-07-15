import time
import subprocess
import sys
from datetime import datetime

def run_news_fetcher():
    """Runs the news automation scheduler module."""
    print(f"\nFetch started at {datetime.now().strftime('%H:%M:%S')}")
    try:
        result = subprocess.run([sys.executable, "-m", "app.scheduler"], capture_output=False)
        if result.returncode == 0:
            print(f"Fetch completed at {datetime.now().strftime('%H:%M:%S')}")
        else:
            print(f"Fetch exited with code {result.returncode}")
    except Exception as e:
        print(f"Error: {e}")

def start_daily_automation():
    print("Daily News Automation")
    print("This script will run every 24 hours and publish news to your website.")
    print("Press Ctrl+C to stop.")
    
    # Run every 4 hours (in seconds)
    DAILY_INTERVAL = 4 * 60 * 60 
    
    try:
        while True:
            # 1. Run the fetcher
            run_news_fetcher()
            
            # 2. Calculate next run time for display
            next_run = datetime.now().timestamp() + DAILY_INTERVAL
            next_run_str = datetime.fromtimestamp(next_run).strftime('%Y-%m-%d %H:%M:%S')
            print(f"\n[INFO] Automation completed successfully.")
            print(f"[INFO] Next run scheduled for: {next_run_str}")
            print("Waiting...")
            
            # Use small sleeps in a loop to allow for easy Ctrl+C interruption
            for _ in range(DAILY_INTERVAL):
                time.sleep(1) 
                
    except KeyboardInterrupt:
        print("\n[STOPPED] Daily automation halted by user.")

if __name__ == "__main__":
    start_daily_automation()
