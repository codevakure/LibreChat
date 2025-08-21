#!/bin/bash
# production-deployment.sh - Production Deployment Script
# Automated deployment script for LibreChat with database selection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

print_header() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "  LibreChat Production Deployment"
    echo "  Multi-Database Support"
    echo "=================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed or not available"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found. Creating from template..."
        cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE" || {
            print_error "Could not create .env file"
            exit 1
        }
        print_warning "Please edit .env file with your configuration before continuing"
        exit 1
    fi
    
    echo "Prerequisites check passed"
}

select_database() {
    print_step "Database Selection"
    
    # Check if DATABASE_TYPE is already set in .env
    if grep -q "^DATABASE_TYPE=" "$ENV_FILE"; then
        CURRENT_DB=$(grep "^DATABASE_TYPE=" "$ENV_FILE" | cut -d'=' -f2)
        echo "Current database type: $CURRENT_DB"
        read -p "Do you want to change it? (y/N): " change_db
        if [[ ! "$change_db" =~ ^[Yy]$ ]]; then
            DATABASE_TYPE="$CURRENT_DB"
            return
        fi
    fi
    
    echo "Select database type:"
    echo "1) MongoDB (Document database, default)"
    echo "2) PostgreSQL (Relational database)"
    
    while true; do
        read -p "Enter choice (1 or 2): " db_choice
        case $db_choice in
            1)
                DATABASE_TYPE="mongodb"
                break
                ;;
            2)
                DATABASE_TYPE="postgresql"
                break
                ;;
            *)
                echo "Invalid choice. Please enter 1 or 2."
                ;;
        esac
    done
    
    # Update .env file
    if grep -q "^DATABASE_TYPE=" "$ENV_FILE"; then
        sed -i "s/^DATABASE_TYPE=.*/DATABASE_TYPE=$DATABASE_TYPE/" "$ENV_FILE"
    else
        echo "DATABASE_TYPE=$DATABASE_TYPE" >> "$ENV_FILE"
    fi
    
    echo "Database type set to: $DATABASE_TYPE"
}

validate_config() {
    print_step "Validating configuration..."
    
    source "$ENV_FILE"
    
    # Check required variables
    if [ "$DATABASE_TYPE" = "postgresql" ]; then
        if [ -z "$POSTGRES_PASSWORD" ]; then
            print_error "POSTGRES_PASSWORD is required for PostgreSQL deployment"
            exit 1
        fi
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        print_warning "JWT_SECRET not set. Generating random secret..."
        JWT_SECRET=$(openssl rand -base64 32)
        echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"
    fi
    
    if [ -z "$JWT_REFRESH_SECRET" ]; then
        print_warning "JWT_REFRESH_SECRET not set. Generating random secret..."
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> "$ENV_FILE"
    fi
    
    echo "Configuration validation passed"
}

deploy_services() {
    print_step "Deploying LibreChat services..."
    
    cd "$PROJECT_ROOT"
    
    # Base compose file
    COMPOSE_FILES="-f docker-compose.production.yml"
    
    # Add database-specific compose file
    if [ "$DATABASE_TYPE" = "mongodb" ]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.mongodb.production.yml"
        echo "Using MongoDB configuration"
    elif [ "$DATABASE_TYPE" = "postgresql" ]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.postgresql.production.yml"
        echo "Using PostgreSQL configuration"
    fi
    
    # Pull latest images
    echo "Pulling latest images..."
    docker-compose $COMPOSE_FILES pull
    
    # Start services
    echo "Starting services..."
    docker-compose $COMPOSE_FILES up -d
    
    # Wait for services to be healthy
    echo "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
}

check_service_health() {
    print_step "Checking service health..."
    
    # Check main application
    for i in {1..30}; do
        if curl -f -s "http://localhost:${PORT:-3080}/api/health" > /dev/null; then
            echo "✓ LibreChat application is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "LibreChat application failed to become healthy"
            docker-compose logs librechat
            exit 1
        fi
        echo "Waiting for LibreChat to be ready... (attempt $i/30)"
        sleep 10
    done
    
    # Check database
    if [ "$DATABASE_TYPE" = "mongodb" ]; then
        if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null; then
            echo "✓ MongoDB is healthy"
        else
            print_warning "MongoDB health check failed"
        fi
    elif [ "$DATABASE_TYPE" = "postgresql" ]; then
        if docker-compose exec -T postgresql pg_isready -U librechat_user > /dev/null; then
            echo "✓ PostgreSQL is healthy"
        else
            print_warning "PostgreSQL health check failed"
        fi
    fi
    
    # Check MeiliSearch
    if curl -f -s "http://localhost:7700/health" > /dev/null; then
        echo "✓ MeiliSearch is healthy"
    else
        print_warning "MeiliSearch health check failed"
    fi
}

setup_monitoring() {
    print_step "Setting up monitoring (optional)..."
    
    read -p "Do you want to enable monitoring (Prometheus + Grafana)? (y/N): " enable_monitoring
    if [[ "$enable_monitoring" =~ ^[Yy]$ ]]; then
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.production.yml --profile monitoring up -d
        echo "Monitoring services started"
        echo "Grafana: http://localhost:3000 (admin/admin)"
        echo "Prometheus: http://localhost:9090"
    fi
}

print_deployment_info() {
    print_step "Deployment completed successfully!"
    
    echo ""
    echo -e "${GREEN}LibreChat is now running at: http://localhost:${PORT:-3080}${NC}"
    echo ""
    echo "Services:"
    echo "- LibreChat Application: http://localhost:${PORT:-3080}"
    echo "- Health Check: http://localhost:${PORT:-3080}/api/health"
    echo "- MeiliSearch: http://localhost:7700"
    
    if [ "$DATABASE_TYPE" = "mongodb" ]; then
        echo "- MongoDB: localhost:27017"
    elif [ "$DATABASE_TYPE" = "postgresql" ]; then
        echo "- PostgreSQL: localhost:5432"
    fi
    
    echo ""
    echo "Useful commands:"
    echo "- View logs: docker-compose logs -f"
    echo "- Stop services: docker-compose down"
    echo "- Update services: ./scripts/production-deployment.sh"
    echo ""
    echo -e "${YELLOW}Note: Edit .env file to customize configuration${NC}"
}

# Main execution
main() {
    print_header
    check_prerequisites
    select_database
    validate_config
    deploy_services
    setup_monitoring
    print_deployment_info
}

# Run main function
main "$@"
