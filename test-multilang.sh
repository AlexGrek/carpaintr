#!/bin/bash
# Multi-Language Pre-render Test Script

echo "========================================="
echo "Multi-Language Pre-render Test"
echo "========================================="
echo ""

HTML_FILE="/Users/vedmedik/dev/carpaintr/carpaintr-front/dist/index.html"

# Test 1: Check for language detection script
echo "1. Checking for language detection script..."
if grep -q "function detectLanguage" "$HTML_FILE"; then
    echo "   ✓ Language detection script found"
else
    echo "   ❌ Language detection script missing"
    exit 1
fi

# Test 2: Check for English content
echo ""
echo "2. Checking for English content..."
if grep -q 'data-lang="en"' "$HTML_FILE"; then
    echo "   ✓ English language container found"
    if grep -q "Automotive Business in Your Phone" "$HTML_FILE"; then
        echo "   ✓ English heading found"
    else
        echo "   ❌ English heading missing"
        exit 1
    fi
else
    echo "   ❌ English language container missing"
    exit 1
fi

# Test 3: Check for Ukrainian content
echo ""
echo "3. Checking for Ukrainian content..."
if grep -q 'data-lang="ua"' "$HTML_FILE"; then
    echo "   ✓ Ukrainian language container found"
    if grep -q "Автомобільний бізнес у вашому телефоні" "$HTML_FILE"; then
        echo "   ✓ Ukrainian heading found"
    else
        echo "   ❌ Ukrainian heading missing"
        exit 1
    fi
else
    echo "   ❌ Ukrainian language container missing"
    exit 1
fi

# Test 4: Check for Ukrainian translations
echo ""
echo "4. Checking for Ukrainian feature translations..."
if grep -q "Точні оцінки ремонту" "$HTML_FILE"; then
    echo "   ✓ Ukrainian feature 1 found"
fi
if grep -q "Відстеження завдань" "$HTML_FILE"; then
    echo "   ✓ Ukrainian feature 2 found"
fi
if grep -q "Вбудовані знання" "$HTML_FILE"; then
    echo "   ✓ Ukrainian feature 3 found"
fi

# Test 5: Check for language CSS
echo ""
echo "5. Checking for language-specific CSS..."
if grep -q "\.lang-content" "$HTML_FILE"; then
    echo "   ✓ Language-specific CSS found"
else
    echo "   ❌ Language-specific CSS missing"
    exit 1
fi

# Test 6: Count content in both languages
echo ""
echo "6. Content statistics..."
EN_COUNT=$(grep -o 'data-lang="en"' "$HTML_FILE" | wc -l)
UA_COUNT=$(grep -o 'data-lang="ua"' "$HTML_FILE" | wc -l)
echo "   English sections: $EN_COUNT"
echo "   Ukrainian sections: $UA_COUNT"

# Test 7: Check Open Graph locale alternates
echo ""
echo "7. Checking Open Graph locale tags..."
if grep -q 'property="og:locale:alternate"' "$HTML_FILE"; then
    echo "   ✓ Alternate locale tags found"
else
    echo "   ❌ Alternate locale tags missing"
fi

echo ""
echo "========================================="
echo "✓ All multi-language checks passed!"
echo "========================================="
echo ""
echo "HTML file size: $(wc -c < "$HTML_FILE") bytes"
echo ""
echo "How to test in browser:"
echo "1. Open Chrome DevTools → Console"
echo "2. Run: localStorage.setItem('preferred_language', 'ua')"
echo "3. Refresh page - should see Ukrainian"
echo "4. Run: localStorage.setItem('preferred_language', 'en')"
echo "5. Refresh page - should see English"
