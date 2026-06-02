#!/bin/bash
# Rollback script - откат к предыдущей версии
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check environment
if [ -z "$1" ]; then
    error "Environment not specified!"
    echo "Usage: $0 <staging|production>"
    exit 1
fi

ENVIRONMENT=$1
APP_NAME="my-app"

if [ "$ENVIRONMENT" == "production" ]; then
    NAMESPACE="production"
else
    NAMESPACE="staging"
fi

warning "Rolling back deployment in $ENVIRONMENT environment..."

# Confirm for production
if [ "$ENVIRONMENT" == "production" ]; then
    echo ""
    read -p "Are you sure you want to rollback PRODUCTION? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        info "Rollback cancelled"
        exit 0
    fi
fi

# Perform rollback
info "Executing rollback..."
kubectl rollout undo deployment/$APP_NAME -n $NAMESPACE

# Wait for rollback to complete
info "Waiting for rollback to complete..."
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=5m

if [ $? -eq 0 ]; then
    info "✅ Rollback completed successfully!"
else
    error "❌ Rollback failed!"
    exit 1
fi

# Show current revision
REVISION=$(kubectl rollout history deployment/$APP_NAME -n $NAMESPACE | tail -n 1 | awk '{print $1}')
info "Current revision: $REVISION"

exit 0
