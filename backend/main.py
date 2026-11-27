import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, lecturers, appointments, notifications, chatbot
from app.database import engine, Base

app = FastAPI(
    title="UMAppoint API",
    description="Appointment booking system for UM lecturers and students",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS – allow the Vite dev server and any deployed frontend
# ---------------------------------------------------------------------------
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router,         prefix="/api/auth",       tags=["Auth"])
app.include_router(lecturers.router,    prefix="/api/lecturers",  tags=["Lecturers"])
app.include_router(appointments.router, prefix="/api",             tags=["Appointments"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(chatbot.router, prefix="/api/chat", tags=["Chatbot"])


@app.get("/", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def root():
    return {"status": "ok", "message": "UMAppoint API is running"}
