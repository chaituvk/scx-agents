#!/bin/bash
set -e

echo "====================================="
echo "  Sierra AI — Local Infra Setup"
echo "====================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install it first:"
    echo "   Mac:   brew install --cask docker"
    echo "   Linux: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Install it:"
    echo "   Mac:   brew install docker-compose"
    echo "   Linux: sudo apt install docker-compose-plugin"
    exit 1
fi

echo "✅ Docker found"
echo ""

# Pull and start
echo "⬇️  Pulling images (pgvector + redis)..."
docker compose pull

echo ""
echo "🚀 Starting containers..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 3

# Health check
PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' sierra-postgres 2>/dev/null || echo "unknown")
REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' sierra-redis 2>/dev/null || echo "unknown")

echo "   PostgreSQL: $PG_HEALTH"
echo "   Redis:      $REDIS_HEALTH"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local with Docker defaults..."
    cat > .env.local << 'EOF'
# ── Database ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://sierra:sierra2026@localhost:5432/sierra

# ── Cache ───────────────────────────────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ── LLM Providers (fill in at least one) ────────────────────────────
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llama3.2
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# ── Auth ────────────────────────────────────────────────────────────
JWT_SECRET=sierra-local-dev-secret-change-in-production
EOF
    echo "✅ .env.local created"
else
    echo "📝 .env.local already exists (not overwritten)"
fi

echo ""
echo "====================================="
echo "  ✅ All services are running!"
echo "====================================="
echo ""
echo "PostgreSQL:  postgresql://sierra:sierra2026@localhost:5432/sierra"
echo "Redis:       redis://localhost:6379"
echo "pgvector:    Enabled (vector extension ready)"
echo ""
echo "Commands:"
echo "  docker compose logs -f    # View logs"
echo "  docker compose down       # Stop everything"
echo "  docker compose down -v    # Stop + delete data"
echo ""
echo "Next: npm run dev"
