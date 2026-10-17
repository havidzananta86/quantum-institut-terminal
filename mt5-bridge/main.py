"""Entry point: `python main.py` (or `uvicorn main:app`)."""
import logging
import os

import uvicorn

from bridge.app import create_app
from bridge.config import Settings

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")

try:
    from dotenv import load_dotenv  # optional convenience for local runs
    load_dotenv()
except ImportError:
    pass

app = create_app(Settings.from_env())

if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")),
                ws_ping_interval=20, ws_ping_timeout=20, proxy_headers=True, forwarded_allow_ips="127.0.0.1")
