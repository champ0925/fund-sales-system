from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.chain import run_agent

app = FastAPI(title="Fund AI Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/ai/query")
async def ai_query(data: dict):
    return run_agent(data.get("question", ""))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)