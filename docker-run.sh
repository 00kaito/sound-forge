#!/bin/bash

# AudioForge Docker Deployment Script
# This script helps you deploy AudioForge using Docker

set -e

echo "🎵 AudioForge Docker Deployment"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start AudioForge services"
    echo "  stop      Stop AudioForge services"
    echo "  restart   Restart AudioForge services"
    echo "  logs      Show logs from services"
    echo "  build     Build AudioForge image"
    echo "  clean     Remove all containers and volumes"
    echo "  status    Show status of services"
    echo "  shell     Open shell in AudioForge container"
    echo ""
}

# Function to start services
start_services() {
    echo "🚀 Starting AudioForge services..."
    
    # Check if .env.production exists, if not copy from .env.docker
    if [ ! -f .env.production ]; then
        echo "📄 Creating .env.production from .env.docker template..."
        cp .env.docker .env.production
        echo "⚠️  Please edit .env.production and set proper values, especially SESSION_SECRET!"
    fi
    
    # Start services
    docker-compose up -d
    
    echo "✅ AudioForge services started!"
    echo "🌐 Application will be available at: http://localhost:5000"
    echo "🗄️  PostgreSQL is available at: localhost:5432"
    echo ""
    echo "Use 'docker-compose logs -f' to follow logs"
    echo "Use '$0 logs' to see current logs"
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping AudioForge services..."
    docker-compose down
    echo "✅ AudioForge services stopped!"
}

# Function to restart services
restart_services() {
    echo "🔄 Restarting AudioForge services..."
    docker-compose restart
    echo "✅ AudioForge services restarted!"
}

# Function to show logs
show_logs() {
    echo "📋 AudioForge service logs:"
    docker-compose logs --tail=50 -f
}

# Function to build image
build_image() {
    echo "🔨 Building AudioForge image..."
    docker-compose build --no-cache
    echo "✅ AudioForge image built!"
}

# Function to clean everything
clean_all() {
    echo "🧹 Cleaning all AudioForge containers and volumes..."
    read -p "This will remove all data including uploaded audio files. Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --remove-orphans
        docker system prune -f
        echo "✅ Cleanup completed!"
    else
        echo "❌ Cleanup cancelled."
    fi
}

# Function to show status
show_status() {
    echo "📊 AudioForge service status:"
    docker-compose ps
}

# Function to open shell
open_shell() {
    echo "🐚 Opening shell in AudioForge container..."
    docker-compose exec audioforge sh
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs
        ;;
    build)
        build_image
        ;;
    clean)
        clean_all
        ;;
    status)
        show_status
        ;;
    shell)
        open_shell
        ;;
    *)
        show_usage
        exit 1
        ;;
esac