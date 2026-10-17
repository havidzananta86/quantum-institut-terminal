# Linux image for DEVELOPMENT / CI only.
# The MetaTrader5 Python package exists only for Windows and needs a running
# terminal64.exe on the same machine, so this image can only run MT5_MOCK=1
# (BRIDGE_ENV=development). Production runs natively on the Windows VPS — see README.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bridge ./bridge
COPY main.py .

RUN useradd --create-home --uid 10001 bridge
USER bridge

ENV HOST=0.0.0.0 PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"
CMD ["python", "main.py"]
