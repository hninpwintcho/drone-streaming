# 🚁 Drone Streaming Stack — RTMP + RTSP Server

> **Boss Requirement Report**: node-media-server (RTMP) + MediaMTX (RTSP) on AWS EC2 with Docker

---

## 📋 Project Background & Boss Requirement

### What We Already Have (Existing System)

The team already operates a **Janus + GStreamer** WebRTC server for drone AI:

```
Drone → GStreamer (RTP/UDP) → Janus Gateway → Browser / AI Detection
```

- Repo: `janus-streaming-server`
- Purpose: Real-time AI detection (< 500ms latency)
- Protocol: WebRTC

### What Boss Wants (This Repo)

Boss requested **2 additional** streaming servers:
1. ✅ **RTMP Server** — `node-media-server` on AWS → for live broadcast/HLS
2. ✅ **RTSP Server** — `MediaMTX` → for NVR, recording, OpenCV/AI

> **This repo fulfills the boss requirement.**

---

## 🏗️ Full Infrastructure Drawing

### Mermaid Diagram (renders on GitHub)

```mermaid
flowchart TD
    subgraph DRONE["🚁 Drone / Camera"]
        CAM["Camera\nGStreamer Pipeline\n(tee — split to 3 outputs)"]
    end

    subgraph EC2A["☁️ AWS EC2 #1 — Janus Server (existing)"]
        JNS["Janus Gateway\n:5001-5100 UDP RTP in\n:443 WSS out"]
    end

    subgraph EC2B["☁️ AWS EC2 #2 — This Repo (new)"]
        RTMP["node-media-server\n:1935 RTMP in\n:8000 HLS out"]
        RTSP["MediaMTX\n:554 RTSP in/out\n:8888 HLS out"]
    end

    subgraph VIEWERS["👁️ Viewers"]
        AI["AI Detection\n(real-time)"]
        BROWSER["Browser\nHLS Player"]
        VLC["VLC / NVR\nRecording"]
    end

    CAM -- "RTP/UDP :5001" --> JNS
    CAM -- "RTMP push :1935" --> RTMP
    CAM -- "RTSP push :554" --> RTSP

    JNS -- "WebRTC wss://" --> AI
    RTMP -- "HLS http://:8000" --> BROWSER
    RTSP -- "RTSP rtsp://:554" --> VLC
    RTSP -- "HLS http://:8888" --> BROWSER
```

---

### Full ASCII Infrastructure Map

```
┌──────────────────────────────────────────────────────────────────┐
│              DRONE AI STREAMING — FULL INFRASTRUCTURE            │
└──────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │   DRONE / PC (GStreamer)            │
  │                                     │
  │  v4l2src / mfvideosrc               │
  │  x264enc (tune=zerolatency)         │
  │  tee  ──┬──────────────────────┐   │
  └─────────┼──────────────────────┼───┘
            │                      │
    rtph264pay               rtph264pay + flvmux
    udpsink                  rtmpsink / rtspclientsink
            │                      │
            ▼                      ▼
  ┌──────────────────┐    ┌────────────────────────────────────┐
  │  EC2 #1: Janus   │    │  EC2 #2: drone-streaming (THIS)   │
  │  (existing repo) │    │                                    │
  │                  │    │  ┌─────────────────────────────┐  │
  │  Janus Gateway   │    │  │  node-media-server (RTMP)   │  │
  │  :5001-5100 UDP  │    │  │  :1935 ← drone RTMP push    │  │
  │  :8188 WS        │    │  │  :8000 → HLS (browser)      │  │
  │  :8989 WSS       │    │  └─────────────────────────────┘  │
  │  :443  Nginx     │    │                                    │
  │                  │    │  ┌─────────────────────────────┐  │
  └────────┬─────────┘    │  │  MediaMTX (RTSP)            │  │
           │              │  │  :554  ← drone RTSP push    │  │
           ▼              │  │  :554  → VLC / NVR / AI     │  │
     AI Detection         │  │  :8888 → HLS (browser)      │  │
     (real-time)          │  │  /recordings → auto MP4     │  │
                          │  └─────────────────────────────┘  │
                          └─────────────┬──────────────────────┘
                                        │
               ┌────────────────────────┼───────────────┐
               ▼                        ▼               ▼
         Browser HLS              VLC / NVR         Recording
         (live watch)             (monitor)         (MP4 files)
```

---

## 🔄 Why 3 Different Systems? (မြန်မာ)

| System | Protocol | Latency | Purpose | Status |
|--------|----------|---------|---------|--------|
| **Janus** | WebRTC | < 500ms | AI real-time detection | ✅ Existing |
| **node-media-server** | RTMP → HLS | 2–5s | Live broadcast, many viewers | 🔴 This repo |
| **MediaMTX** | RTSP | 1–3s | NVR, recording, OpenCV | 🔴 This repo |

> **Janus** = မပြောင်းပါ (AI detection အတွက် ဆက်သုံး)
> **RTMP + RTSP** = Boss requirement — ဤ repo တွင် implement

---

## 📁 Project Structure

```
drone-streaming/
  README.md                   ← this file (full report)
  docker-compose.yml          ← start everything: RTMP + RTSP
  .env.example                ← secrets template
  ec2-bootstrap.sh            ← paste into EC2 User Data
  rtmp-server/
    app.js                    ← node-media-server (RTMP + HLS)
    package.json
    Dockerfile
  rtsp-server/
    mediamtx.yml              ← RTSP / HLS / auto-recording config
```

---

## 🚀 Step-by-Step Deployment

### Step 1 — Launch AWS EC2

| Setting | Value |
|---------|-------|
| AMI | Ubuntu 22.04 LTS |
| Instance Type | t3.medium |
| Storage | 30 GB SSD |

**Security Group Ports:**

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 1935 | TCP | RTMP ingest (drone → server) |
| 8000 | TCP | HLS playback + node-media-server API |
| 554 | TCP | RTSP (VLC / NVR / OpenCV) |
| 8888 | TCP | HLS from MediaMTX (browser) |

---

### Step 2 — Install Docker

Paste `ec2-bootstrap.sh` into **EC2 User Data** on launch, OR run manually:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu && newgrp docker
sudo apt install -y docker-compose-plugin
```

---

### Step 3 — Clone & Deploy

```bash
git clone https://github.com/YOUR_USER/drone-streaming.git
cd drone-streaming
cp .env.example .env
nano .env           # set API_PASS
docker compose up -d
docker compose ps   # verify
```

---

### Step 4 — Drone GStreamer Push

**RTMP only:**
```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! \
  video/x-raw,width=1280,height=720,framerate=30/1 ! \
  videoconvert ! \
  x264enc tune=zerolatency bitrate=2000 key-int-max=30 ! \
  flvmux streamable=true ! \
  rtmpsink location="rtmp://YOUR_EC2_IP:1935/live/drone_stream live=1"
```

**RTSP only:**
```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! videoconvert ! \
  x264enc tune=zerolatency bitrate=1500 ! \
  rtspclientsink \
    location="rtsp://drone:droneSecret2024!@YOUR_EC2_IP:554/drone_stream" \
    protocols=tcp
```

**All 3 at once (Janus + RTMP + RTSP via tee):**
```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! \
  video/x-raw,width=1280,height=720,framerate=30/1 ! \
  videoconvert ! tee name=t \
    t. ! queue ! x264enc tune=zerolatency ! rtph264pay ! \
         udpsink host=JANUS_IP port=5001 sync=false \
    t. ! queue ! x264enc tune=zerolatency ! flvmux streamable=true ! \
         rtmpsink location="rtmp://RTMP_IP:1935/live/drone_stream live=1" \
    t. ! queue ! x264enc tune=zerolatency ! \
         rtspclientsink location="rtsp://drone:droneSecret2024!@RTSP_IP:554/drone_stream" protocols=tcp
```

---

### Step 5 — Verify

| Check | URL |
|-------|-----|
| RTMP API | `http://YOUR_EC2_IP:8000/api/streams` |
| HLS (RTMP) | `http://YOUR_EC2_IP:8000/live/drone_stream/index.m3u8` |
| RTSP (VLC) | `rtsp://YOUR_EC2_IP:554/drone_stream` |
| HLS (RTSP) | `http://YOUR_EC2_IP:8888/drone_stream/index.m3u8` |
| Container status | `docker compose ps` |

---

## 🐳 Docker Commands

```bash
docker compose up -d          # start
docker compose down           # stop
docker compose ps             # status
docker compose logs -f        # live logs
docker compose restart        # restart
```

---

## 📌 Related Repos

| Repo | Purpose |
|------|---------|
| **[janus-streaming-server](https://github.com/Augustine423/janus-streaming-server)** | Janus WebRTC (real-time AI, existing) |
| **This repo: drone-streaming** | RTMP (node-media-server) + RTSP (MediaMTX) — boss requirement |
