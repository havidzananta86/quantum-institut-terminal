import urllib.request
import json
import os

url = "https://www.tikwm.com/api/?url=https://www.tiktok.com/@02h.bia/video/7692352104849067282"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

os.makedirs("assets/audio", exist_ok=True)
out_file = "assets/audio/bgm.mp3"

try:
    req = urllib.request.Request(url, headers=headers)
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode("utf-8"))
    
    print("API Response code:", data.get("code"))
    music_url = data.get("data", {}).get("music") or data.get("data", {}).get("play")
    print("Music URL:", music_url)
    
    if music_url:
        if music_url.startswith("//"):
            music_url = "https:" + music_url
        elif not music_url.startswith("http"):
            music_url = "https://www.tikwm.com" + music_url
            
        m_req = urllib.request.Request(music_url, headers=headers)
        m_data = urllib.request.urlopen(m_req).read()
        with open(out_file, "wb") as f:
            f.write(m_data)
        print(f"SUCCESS! Downloaded {len(m_data)} bytes to {out_file}")
    else:
        print("Music URL not found in response:", data)
except Exception as e:
    print("Error:", e)
