# 🚁 Drone Streaming Stack

> **RTMP + RTSP streaming server for Drone AI — deployed on AWS EC2 with Docker.**  
> Boss Requirement: node-media-server (RTMP) + MediaMTX (RTSP)

---

## 📐 Architecture

```
[Drone Camera + GStreamer]
        │
        ├──► WebRTC ──► Janus ──────────► AI Real-time     (existing)
        │
        ├──► RTMP ───► node-media-server
        │                  └──► HLS ────► Browser/Player   (new)
        │
        └──► RTSP ───► MediaMTX
                           ├──► VLC / NVR                   (new)
                           ├──► OpenCV / AI System          (new)
                           └──► Auto Recording (MP4)        (new)
```

---

## 📁 Project Structure

```
drone-streaming/
  README.md
  docker-compose.yml        ← run entire stack
  .env.example              ← secrets template
  ec2-bootstrap.sh          ← paste into EC2 User Data
  rtmp-server/
    app.js                  ← node-media-server (RTMP + HLS)
    package.json
    Dockerfile
  rtsp-server/
    mediamtx.yml            ← RTSP / HLS / recording config
```

---

## 🚀 Implementation Plan

### Phase 1 — AWS EC2 Setup

**Step 1: Launch EC2 Instance**

| Setting | Value |
|---------|-------|
| AMI | Ubuntu 22.04 LTS |
| Instance Type | t3.medium (2 vCPU, 4 GB RAM) |
| Storage | 30 GB SSD |
| Key Pair | Create or use existing `.pem` |

**Step 2: Security Group — Open Ports**

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 1935 | TCP | RTMP ingest (drone → server) |
| 8000 | TCP | HLS playback + API |
| 554 | TCP | RTSP (VLC / NVR / OpenCV) |
| 8888 | TCP | HLS from RTSP (browser) |

**Step 3: Install Docker (paste `ec2-bootstrap.sh` into EC2 User Data)**

Or run manually after SSH:
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu && newgrp docker
sudo apt install -y docker-compose-plugin
docker compose version   # verify
```

---

### Phase 2 — Deploy Streaming Stack

**Step 4: Clone repo & configure**

```bash
# On EC2
git clone https://github.com/YOUR_USER/drone-streaming.git ~/drone-streaming
cd ~/drone-streaming

# Set secrets
cp .env.example .env
nano .env        # change API_PASS to a strong password
```

**Step 5: Start all services**

```bash
docker compose up -d
```

**Step 6: Verify containers are running**

```bash
docker compose ps
# Expected output:
# NAME          STATUS    PORTS
# drone-rtmp    Up        0.0.0.0:1935->1935, 0.0.0.0:8000->8000
# drone-rtsp    Up        0.0.0.0:554->8554, 0.0.0.0:8888->8888
```

---

### Phase 3 — Connect Drone

**Step 7: Push RTMP stream from drone**

```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! \
  video/x-raw,width=1280,height=720,framerate=30/1 ! \
  videoconvert ! \
  x264enc tune=zerolatency bitrate=2000 key-int-max=30 ! \
  flvmux streamable=true ! \
  rtmpsink location="rtmp://YOUR_EC2_IP:1935/live/drone_stream live=1"
```

**Step 8: Push RTSP stream from drone**

```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! \
  videoconvert ! \
  x264enc tune=zerolatency bitrate=1500 ! \
  rtspclientsink \
    location="rtsp://drone:droneSecret2024!@YOUR_EC2_IP:554/drone_stream" \
    protocols=tcp
```

> **Tip:** Use both at once with GStreamer `tee`:  
> `t. ! queue ! ... rtmpsink ...`  
> `t. ! queue ! ... rtspclientsink ...`

---

### Phase 4 — Verify & Watch

**Step 9: Check RTMP API**
```bash
curl http://YOUR_EC2_IP:8000/api/streams
```

**Step 10: Watch streams**

| Client | URL |
|--------|-----|
| Browser (HLS/RTMP) | `http://YOUR_EC2_IP:8000/live/drone_stream/index.m3u8` |
| VLC (RTSP) | `rtsp://YOUR_EC2_IP:554/drone_stream` |
| Browser (HLS/RTSP) | `http://YOUR_EC2_IP:8888/drone_stream/index.m3u8` |
| Python OpenCV | `cv2.VideoCapture('rtsp://YOUR_EC2_IP:554/drone_stream')` |

---

## 🐳 Docker Commands Reference

```bash
docker compose up -d          # start stack
docker compose down           # stop stack
docker compose ps             # container status
docker compose logs -f        # live logs (all)
docker compose logs rtmp-server -f   # RTMP logs only
docker compose logs rtsp-server -f   # RTSP logs only
docker compose restart        # restart all
docker compose pull           # update images
```

---

## 📦 Push to GitHub

```bash
cd ~/drone-streaming

git init
git add .
git commit -m "feat: drone streaming stack (RTMP + RTSP) with Docker"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/drone-streaming.git
git branch -M main
git push -u origin main
```

> ⚠️ **Never commit `.env`** — only `.env.example` goes to GitHub.  
> Add `.env` to `.gitignore`:
> ```bash
> echo ".env" >> .gitignore
> ```

---

## 🔧 Configuration

Edit `rtsp-server/mediamtx.yml` to change:
- RTSP publish credentials (`publishUser` / `publishPass`)
- Recording duration and path
- Enable/disable HLS, WebRTC

Edit `rtmp-server/app.js` to change:
- RTMP stream key auth
- Event hooks (notify AI system on stream start)
- HLS segment timing

---

## 📊 Protocol Comparison

| | RTMP (node-media-server) | RTSP (MediaMTX) |
|--|---|---|
| Protocol | RTMP → HLS | RTSP → HLS |
| Port | 1935 / 8000 | 554 / 8888 |
| Best for | Browser / OBS / broadcast | VLC / NVR / OpenCV / AI |
| Latency | ~2-5s | ~1-3s |
| Recording | Manual | ✅ Auto (MP4) |
