#!/bin/bash
# Deployment script for staging/production environments
# Деплоит приложение в Kubernetes

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="my-app"
DOCKER_REGISTRY="ghcr.io/myorg"
K8S_NAMESPACE_STAGING="staging"
K8S_NAMESPACE_PROD="production"

# Print colored messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    error "Environment not specified!"
    echo "Usage: $0 <staging|production>"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    error "Invalid environment: $ENVIRONMENT"
    echo "Valid environments: staging, production"
    exit 1
fi

# Set namespace based on environment
if [ "$ENVIRONMENT" == "production" ]; then
    NAMESPACE=$K8S_NAMESPACE_PROD
else
    NAMESPACE=$K8S_NAMESPACE_STAGING
fi

info "Starting deployment to $ENVIRONMENT environment..."

# Step 1: Build Docker image
info "Step 1/5: Building Docker image..."
VERSION=$(date +%Y%m%d%H%M%S)
IMAGE_TAG="$DOCKER_REGISTRY/$APP_NAME:$VERSION"

docker build -t "$IMAGE_TAG" .
if [ $? -ne 0 ]; then
    error "Docker build failed!"
    exit 1
fi
info "Docker image built: $IMAGE_TAG"

# Step 2: Push to registry
info "Step 2/5: Pushing image to registry..."
docker push "$IMAGE_TAG"
if [ $? -ne 0 ]; then
    error "Docker push failed!"
    exit 1
fi
info "Image pushed to registry"

# Step 3: Update Kubernetes deployment
info "Step 3/5: Updating Kubernetes deployment..."
kubectl set image deployment/$APP_NAME \
    $APP_NAME=$IMAGE_TAG \
    -n $NAMESPACE

if [ $? -ne 0 ]; then
    error "Kubernetes deployment update failed!"
    exit 1
fi

# Step 4: Wait for rollout
info "Step 4/5: Waiting for rollout to complete..."
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=5m

if [ $? -ne 0 ]; then
    error "Rollout failed! Rolling back..."
    kubectl rollout undo deployment/$APP_NAME -n $NAMESPACE
    exit 1
fi

# Step 5: Health check
info "Step 5/5: Running health checks..."

# Wait a bit for pods to stabilize
sleep 10

# Check if pods are running
READY_PODS=$(kubectl get deployment $APP_NAME -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
DESIRED_PODS=$(kubectl get deployment $APP_NAME -n $NAMESPACE -o jsonpath='{.status.replicas}')

if [ "$READY_PODS" != "$DESIRED_PODS" ]; then
    error "Not all pods are ready! ($READY_PODS/$DESIRED_PODS)"
    exit 1
fi

# Get service URL
if [ "$ENVIRONMENT" == "production" ]; then
    SERVICE_URL="https://app.example.com"
else
    SERVICE_URL="https://staging.app.example.com"
fi

# Health check
info "Checking service health: $SERVICE_URL/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")

if [ "$HTTP_CODE" == "200" ]; then
    info "Health check passed!"
else
    warning "Health check returned: $HTTP_CODE"
fi

# Success!
echo ""
echo "========================================"
info "✅ Deployment to $ENVIRONMENT completed successfully!"
echo "========================================"
echo ""
echo "Deployment details:"
echo "  Environment: $ENVIRONMENT"
echo "  Namespace: $NAMESPACE"
echo "  Image: $IMAGE_TAG"
echo "  Pods: $READY_PODS/$DESIRED_PODS ready"
echo "  URL: $SERVICE_URL"
echo ""
info "Monitor logs with: kubectl logs -f deployment/$APP_NAME -n $NAMESPACE"
echo ""

exit 0
