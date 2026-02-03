#!/bin/bash
# Update all navigation links to use /app prefix

SRC_DIR="/Users/vedmedik/dev/carpaintr/carpaintr-front/src"

echo "Updating navigation links to use /app prefix..."
echo ""

# Array of files to update
FILES=(
  "$SRC_DIR/components/layout/TopBarUser.jsx"
  "$SRC_DIR/components/layout/TopBarDashboard.jsx"
  "$SRC_DIR/components/layout/TopBar.jsx"
  "$SRC_DIR/components/pages/RegistrationPage.jsx"
  "$SRC_DIR/components/pages/AdminPage.jsx"
  "$SRC_DIR/components/ManageUsers.jsx"
  "$SRC_DIR/components/editor/FilesystemBrowser.jsx"
  "$SRC_DIR/ErrorBoundary.jsx"
)

# Routes that should be updated (excluding root / and /api)
ROUTES=(
  "/login"
  "/register"
  "/dashboard"
  "/cabinet"
  "/calc"
  "/calc2"
  "/admin"
  "/company"
  "/catalog"
  "/history"
  "/aboutus"
  "/fileeditor"
  "/wip"
  "/report"
  "/create-proc"
  "/templates"
)

# Update each file
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating: $file"

    # Update navigate() calls
    for route in "${ROUTES[@]}"; do
      sed -i '' "s|navigate(\"${route}\"|navigate(\"/app${route}\"|g" "$file"
      sed -i '' "s|navigate('${route}'|navigate('/app${route}'|g" "$file"
    done

    # Update <Link to=> components
    for route in "${ROUTES[@]}"; do
      sed -i '' "s|to=\"${route}\"|to=\"/app${route}\"|g" "$file"
      sed -i '' "s|to='${route}'|to='/app${route}'|g" "$file"
    done

    # Update href attributes
    for route in "${ROUTES[@]}"; do
      # Only update plain routes, not query strings
      sed -i '' "s|href=\"${route}\"|href=\"/app${route}\"|g" "$file"
      sed -i '' "s|href='${route}'|href='/app${route}'|g" "$file"
    done

  else
    echo "File not found: $file"
  fi
done

echo ""
echo "Done! Updated all navigation links."
echo ""
echo "Summary of changes:"
echo "  ✓ /login → /app/login"
echo "  ✓ /register → /app/register"
echo "  ✓ /dashboard → /app/dashboard"
echo "  ✓ /cabinet → /app/cabinet"
echo "  ✓ /calc → /app/calc"
echo "  ✓ And all other app routes..."
echo ""
echo "Root / and /api/* routes remain unchanged."
