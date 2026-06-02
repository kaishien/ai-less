import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from gigachat import GigaChat
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

PORT = 3000


class MessageRequest(BaseModel):
    message: str


@app.post("/ai")
def process_ai_request(body: MessageRequest):
    try:
        with GigaChat(
            credentials=os.getenv("GIGACHAT_CREDENTIALS"),
            verify_ssl_certs=False,
            model="GigaChat-2",
        ) as giga:
            response = giga.chat(body.message)
            return {"response": response.choices[0].message.content}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
