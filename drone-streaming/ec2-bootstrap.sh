#!/bin/bash
# ================================================================
# AWS EC2 Docker Bootstrap Script
# Run as EC2 User Data OR manually after SSH
# Ubuntu 22.04 LTS
# ================================================================

set -e

# ── 1. System update ──────────────────────────────────
apt-get update -y
apt-get upgrade -y

# ── 2. Install Docker ─────────────────────────────────
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# ── 3. Install Docker Compose plugin ─────────────────
apt-get install -y docker-compose-plugin

# ── 4. Create project directory ───────────────────────
mkdir -p /home/ubuntu/drone-streaming
chown ubuntu:ubuntu /home/ubuntu/drone-streaming

# ── 5. Done ───────────────────────────────────────────
echo "========================================"
echo " ✅ Docker ready on EC2!"
echo " Next: copy drone-streaming/ then run:"
echo "   cd ~/drone-streaming"
echo "   cp .env.example .env && nano .env"
echo "   docker compose up -d"
echo "========================================"
