from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import crud, models, database
from .database import engine

# Create the database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Free News Automation API")

# CORS — allow the main website and Next.js to fetch news
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "https://britsync.co.uk", "https://www.britsync.co.uk"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/public", StaticFiles(directory="public"), name="public")

@app.get("/")
def read_root():
    return {"message": "Welcome to the News Automation API", "endpoints": ["/news/ai", "/news/lifestyle", "/news/world"]}

@app.get("/news/ai")
def get_ai_news(db: Session = Depends(database.get_db)):
    return crud.get_articles_by_category(db, category="ai")

@app.get("/news/lifestyle")
def get_lifestyle_news(db: Session = Depends(database.get_db)):
    return crud.get_articles_by_category(db, category="lifestyle")

@app.get("/news/world")
def get_world_news(db: Session = Depends(database.get_db)):
    return crud.get_articles_by_category(db, category="world")

@app.get("/article/{article_id}")
def get_article(article_id: int, db: Session = Depends(database.get_db)):
    article = crud.get_article_by_id(db, article_id)
    if article is None:
        return {"success": False, "error": "Article not found"}
    return {"success": True, "data": article}
