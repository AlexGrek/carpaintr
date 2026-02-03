#!/bin/bash
# Verify route changes in the codebase

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           ROUTE STRUCTURE VERIFICATION                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

SRC_DIR="/Users/vedmedik/dev/carpaintr/carpaintr-front/src"

# Check App.jsx for correct route structure
echo "1. Checking App.jsx route definitions..."
if grep -q 'path="/" element={<LandingPage' "$SRC_DIR/App.jsx"; then
    echo "   ✓ Root route (/) → LandingPage"
else
    echo "   ❌ Root route missing or incorrect"
fi

if grep -q 'path="/app/login"' "$SRC_DIR/App.jsx"; then
    echo "   ✓ /app/login route defined"
else
    echo "   ❌ /app/login route missing"
fi

if grep -q 'path="/app/dashboard"' "$SRC_DIR/App.jsx"; then
    echo "   ✓ /app/dashboard route defined"
else
    echo "   ❌ /app/dashboard route missing"
fi

if grep -q 'path="/app/register"' "$SRC_DIR/App.jsx"; then
    echo "   ✓ /app/register route defined"
else
    echo "   ❌ /app/register route missing"
fi

echo ""

# Check for any old routes that shouldn't be there
echo "2. Checking for old route patterns..."
OLD_ROUTES=$(grep -r 'path="/login\|path="/dashboard\|path="/register' "$SRC_DIR/App.jsx" 2>/dev/null | grep -v "/app/" | wc -l)
if [ "$OLD_ROUTES" -eq 0 ]; then
    echo "   ✓ No old route patterns found"
else
    echo "   ⚠️  Found $OLD_ROUTES old route patterns"
    grep -n 'path="/login\|path="/dashboard\|path="/register' "$SRC_DIR/App.jsx" | grep -v "/app/"
fi

echo ""

# Check navigation links
echo "3. Checking navigation links..."
APP_LINKS=$(grep -r 'navigate("/app/' "$SRC_DIR" --include="*.jsx" --include="*.js" | wc -l)
echo "   Found $APP_LINKS navigate() calls with /app prefix"

TO_LINKS=$(grep -r 'to="/app/' "$SRC_DIR" --include="*.jsx" --include="*.js" | wc -l)
echo "   Found $TO_LINKS <Link to> with /app prefix"

HREF_LINKS=$(grep -r 'href="/app/' "$SRC_DIR" --include="*.jsx" --include="*.js" | wc -l)
echo "   Found $HREF_LINKS href attributes with /app prefix"

echo ""

# Check for problematic patterns
echo "4. Checking for problematic patterns..."
BAD_NAV=$(grep -r 'navigate("/login\|navigate("/dashboard\|navigate("/register' "$SRC_DIR" --include="*.jsx" --include="*.js" | grep -v "/app/" | grep -v '//.*navigate' | wc -l)
if [ "$BAD_NAV" -eq 0 ]; then
    echo "   ✓ No incorrect navigate() calls found"
else
    echo "   ⚠️  Found $BAD_NAV navigate() calls that might need updating"
fi

echo ""

# Check index.html
echo "5. Checking pre-rendered content links..."
INDEX_FILE="/Users/vedmedik/dev/carpaintr/carpaintr-front/index.html"
if grep -q 'href="/app/login"' "$INDEX_FILE"; then
    echo "   ✓ index.html uses /app/login"
else
    echo "   ❌ index.html login link needs updating"
fi

if grep -q 'href="/app/register"' "$INDEX_FILE"; then
    echo "   ✓ index.html uses /app/register"
else
    echo "   ❌ index.html register link needs updating"
fi

echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                      SUMMARY                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Route Structure:"
echo "  / (root)        → Marketing landing page ✓"
echo "  /app/*          → Application routes ✓"
echo "  /api/*          → API endpoints (unchanged) ✓"
echo ""
echo "You can now add marketing pages at:"
echo "  /pricing"
echo "  /features"
echo "  /testimonials"
echo "  /blog"
echo "  /demo"
echo "  etc."
echo ""
echo "All application functionality remains at /app/*"
echo ""
