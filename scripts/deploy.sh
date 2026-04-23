#!/bin/bash
set -e

# Elemental Pro deployment script
# Usage: ./scripts/deploy.sh [stage]

STAGE=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "  Elemental Pro Deployment"
echo "  Stage: $STAGE"
echo "======================================"

# Check required tools
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "ERROR: $1 is not installed"
    exit 1
  fi
}

check_tool node
check_tool npm
check_tool aws
check_tool cdk

echo ""
echo "Step 1: Building backend..."
cd "$ROOT_DIR/backend"
npm ci
npx prisma generate
npm run build
echo "Backend built successfully"

echo ""
echo "Step 2: Deploying infrastructure..."
cd "$ROOT_DIR/infrastructure"
npm ci
cdk deploy "ElementalPro-$STAGE" \
  --require-approval never \
  --context stage="$STAGE"

echo ""
echo "Step 3: Getting infrastructure outputs..."
STACK_NAME="ElementalPro-$STAGE"
CF_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
  --output text 2>/dev/null || echo "")

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text 2>/dev/null || echo "")

CF_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text 2>/dev/null || echo "")

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FullApiUrl'].OutputValue" \
  --output text 2>/dev/null || echo "")

COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text 2>/dev/null || echo "")

COGNITO_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text 2>/dev/null || echo "")

COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" \
  --output text 2>/dev/null || echo "")

echo "CloudFront Domain: $CF_DOMAIN"
echo "API URL: $API_URL"
echo "Cognito User Pool: $COGNITO_USER_POOL_ID"

echo ""
echo "Step 4: Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci

# Create .env file for the build
cat > .env.production << EOF
VITE_API_URL=${API_URL}
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
VITE_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
VITE_COGNITO_DOMAIN=${COGNITO_DOMAIN}
VITE_COGNITO_REDIRECT_URI=https://${CF_DOMAIN}
EOF

npm run build
echo "Frontend built successfully"

echo ""
echo "Step 5: Deploying frontend to S3..."
if [ -n "$FRONTEND_BUCKET" ]; then
  aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --delete
  echo "Frontend deployed to S3"

  if [ -n "$CF_DISTRIBUTION_ID" ]; then
    echo "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "$CF_DISTRIBUTION_ID" \
      --paths "/*"
    echo "CloudFront cache invalidated"
  fi
else
  echo "WARNING: Could not find frontend bucket, skipping S3 deployment"
fi

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "Frontend URL: https://$CF_DOMAIN"
echo "API URL: $API_URL"
echo ""
echo "Next steps:"
echo "1. Set your Google OAuth credentials in the Cognito User Pool"
echo "2. Update the Cognito domain callback URLs if needed"
echo "3. Run database migrations: cd backend && npx prisma migrate deploy"
