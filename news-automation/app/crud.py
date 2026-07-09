from sqlalchemy.orm import Session
from . import models

def get_articles_by_category(db: Session, category: str, limit: int = 50):
    return db.query(models.Article).filter(models.Article.category == category).order_by(models.Article.publish_date.desc()).limit(limit).all()

def get_article_by_id(db: Session, article_id: int):
    return db.query(models.Article).filter(models.Article.id == article_id).first()

def create_article(db: Session, article_data: dict):
    db_article = models.Article(**article_data)
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return db_article

def article_exists(db: Session, link: str):
    return db.query(models.Article).filter(models.Article.link == link).first() is not None
