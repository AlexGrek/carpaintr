#!/bin/bash
# SEO Pre-render Test Script

echo "==================================="
echo "Testing Pre-rendered Content"
echo "==================================="
echo ""

# Test 1: Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Server not running on localhost:3000"
    echo "   Start with: task dev"
    exit 1
fi

echo "✓ Server is running"
echo ""

# Fetch the HTML
HTML=$(curl -s http://localhost:3000)

# Test 2: Check for pre-rendered content div
if echo "$HTML" | grep -q "prerendered-content"; then
    echo "✓ Pre-rendered content container found"
else
    echo "❌ Pre-rendered content container missing"
    exit 1
fi

# Test 3: Check for main heading
if echo "$HTML" | grep -q "Automotive Business in Your Phone"; then
    echo "✓ Main heading found in HTML"
else
    echo "❌ Main heading missing"
    exit 1
fi

# Test 4: Check for features
if echo "$HTML" | grep -q "Accurate Repair Estimation"; then
    echo "✓ Feature content found"
else
    echo "❌ Feature content missing"
    exit 1
fi

# Test 5: Check for meta description
if echo "$HTML" | grep -q "Professional automotive repair estimation"; then
    echo "✓ SEO meta description found"
else
    echo "❌ SEO meta description missing"
    exit 1
fi

# Test 6: Check for structured data
if echo "$HTML" | grep -q '"@type": "SoftwareApplication"'; then
    echo "✓ Structured data (JSON-LD) found"
else
    echo "❌ Structured data missing"
    exit 1
fi

# Test 7: Check for Open Graph tags
if echo "$HTML" | grep -q 'property="og:title"'; then
    echo "✓ Open Graph tags found"
else
    echo "❌ Open Graph tags missing"
    exit 1
fi

echo ""
echo "==================================="
echo "✓ All SEO checks passed!"
echo "==================================="
echo ""
echo "Content size: $(echo "$HTML" | wc -c) bytes"
echo "H1 tags found: $(echo "$HTML" | grep -o '<h1>' | wc -l)"
echo "H2 tags found: $(echo "$HTML" | grep -o '<h2>' | wc -l)"
echo "H3 tags found: $(echo "$HTML" | grep -o '<h3>' | wc -l)"
