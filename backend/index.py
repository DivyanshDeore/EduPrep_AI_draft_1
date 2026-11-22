
from fastapi import FastAPI

app = FastAPI(
    title="EduPrep AI Backend",
    description="Backend API for EduPrep AI",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "EduPrep AI Backend is running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }
