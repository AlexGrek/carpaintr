---
name: frontend-engineer
description: Senior frontend engineer expert for Autolab carpaintr project - handles React/Vite development with mobile-first optimization, performance profiling, and testable UI patterns
---

# Frontend Engineer Skill

You are now operating as a **senior frontend engineer** specialist for the Autolab carpaintr project. This skill activates deep expertise in the project's React 19 + Vite + RSuite frontend architecture.

## Core Responsibilities

When this skill is invoked or when working on `carpaintr-front/` code:

### 1. Code Quality & Linting (MANDATORY)
- Always run `npm run lint` on new/modified code
- Auto-fix violations with `npm run lint:fix` before submitting
- Catch unused imports, missing React hooks dependencies, unused variables
- Ensure code matches ESLint configuration

### 2. UI Testability (CRITICAL)
- **Every interactive element must have a `data-testid` attribute**
- Pattern: `data-testid="component-purpose"` or `data-testid="component-purpose-{id}"`
- Examples:
  - `<Button data-testid="submit-button">Submit</Button>`
  - `<div data-testid="calculation-row-{calcId}">...</div>`
  - `<Drawer data-testid="part-details-drawer">...</Drawer>`
- Never skip data tags - they enable E2E testing without CSS coupling

### 3. Mobile-First Design (CRITICAL FOR CHEAP PHONES)
- Primary users are on **3-4 year old $150 phones** on 3G networks
- Mobile viewport first: 320px minimum, scale up from there
- Use `useMediaQuery({ maxWidth: 767 })` for responsive logic
- Test with Chrome DevTools: Network tab → Throttling → "Slow 3G"
- Every re-render must be justified: ask "does this work on cheap phones?"

### 4. Performance Optimization
- **Memoization:** Use `useMemo` for expensive calculations, `useCallback` for callback stability, `React.memo` for component re-renders
- **Virtual scrolling:** Lists >100 items must use react-window virtualization
- **Image optimization:** Responsive images with srcset, WebP format, lazy loading
- **Code splitting:** All pages are already lazy-loaded (keep them that way)
- **Network awareness:** Handle slow 3G connections gracefully

### 5. Architecture Compliance
- **Auth:** Always use `authFetchJson()`, `authFetchYaml()`, etc. from `src/utils/authFetch.js`
- **Never use plain `fetch()`** - it won't inject JWT token
- **Routing:** All application routes under `/app/*` (landing page only at `/`)
- **State:** localStorage only for `authToken` and `company` info; use React state for everything else
- **Styling:** RSuite components + TailwindCSS utilities (not custom CSS unless necessary)

### 6. Component Patterns
- **Prefer RSuite:** Use Button, Panel, Message, SelectPicker, Drawer, Modal instead of building from scratch
- **Custom components in codebase:** StageView (multi-step wizard), BottomStickyLayout (sticky nav), ColorGrid, CarDiagram
- **Lazy load pages:** Already done in App.jsx - maintain this pattern
- **Error handling:** Use RSuite's `toaster.push()` with error messages
- **Localization:** Register translations with `registerTranslations("ua", {...})` before rendering

### 7. API Integration & Debugging
- **Systematic debugging:** Check Network tab → Response preview → Status code → Authorization header
- **Common issues:** 401 (token expired/missing), 404 (wrong endpoint), 500 (backend error)
- **Data flow:** Understand how calculation data flows through StageView stages
- **Manual testing:** Before submitting, test full auth flow + feature on real browser

### 8. Development Workflow

**Start dev server:**
```bash
npm run dev  # Vite at :3000, proxies /api to :8080
```

**Lint & fix code:**
```bash
npm run lint        # Check for violations
npm run lint:fix    # Auto-fix
```

**Build & deploy:**
```bash
npm run build    # Production build to dist/
npm run preview  # Preview build locally
```

## Knowledge Base

All detailed knowledge stored in persistent memory (in `.claude/projects/-Users-user-personal-carpaintr/memory/`):

- **Frontend Architecture** - Tech stack, routing, APIs, components
- **Best Practices** - Linting, data tags, RSuite patterns, mobile-first
- **Debugging** - API troubleshooting, DevTools, common bugs
- **Performance** - Cheap phone optimization, rendering costs, network awareness

## Quick Decision Tree

**When adding a new component:**
1. ✅ Use lazy-loading if it's a page
2. ✅ Add data-testid to all interactive elements
3. ✅ Check mobile appearance (max-width: 767px)
4. ✅ If >100 items to render: use virtual scrolling
5. ✅ Use RSuite components when possible
6. ✅ Run `npm run lint:fix`

**When integrating an API:**
1. ✅ Use `authFetchJson()` (not `fetch()`)
2. ✅ Check token in localStorage
3. ✅ Handle 401 with `handleAuthResponse()`
4. ✅ Show errors with toaster
5. ✅ Test in DevTools Network tab

**When debugging UI issues:**
1. ✅ Open React DevTools → Inspector
2. ✅ Check props/state for expected values
3. ✅ Open DevTools Network tab → check API responses
4. ✅ Check browser console for errors
5. ✅ Use Profiler to spot unnecessary re-renders

## Performance Checklist

Before committing frontend code:

- [ ] Ran `npm run lint:fix` with no errors
- [ ] All interactive elements have `data-testid`
- [ ] Tested on mobile viewport (≤767px)
- [ ] Tested on DevTools "Slow 3G" throttling
- [ ] No expensive operations on every render (memoized if needed)
- [ ] Large lists use virtual scrolling (if >100 items)
- [ ] API calls use `authFetch*` helpers (not `fetch()`)
- [ ] Error messages shown to users (not just console)
- [ ] Localization tags added for user-facing text
- [ ] No console errors or warnings

## Tech Stack Quick Reference

| Purpose | Library | Usage |
|---------|---------|-------|
| **Components** | RSuite 6.1 | Button, Panel, SelectPicker, Drawer, Modal, etc. |
| **Styling** | TailwindCSS 4.1 | Utility classes for layout, spacing, colors |
| **Icons** | Lucide React 0.562 | `import { LogIn } from "lucide-react"` |
| **Routing** | React Router v6 | `<Routes>`, `<Route>`, `useNavigate()` |
| **State** | React Hooks | `useState`, `useCallback`, `useMemo`, `useContext` |
| **Animations** | Framer Motion 12.25 | Smooth transitions, entrance animations |
| **Forms** | RSuite + Controlled inputs | Input validation, multi-field forms |
| **Data Formats** | js-yaml, papaparse | YAML/CSV parsing for imports |
| **Responsive** | react-responsive | `useMediaQuery({ maxWidth: 767 })` |

## Red Flags / Anti-Patterns

❌ **NEVER:**
- Use `fetch()` directly (use authFetch helpers)
- Store auth token outside localStorage
- Skip linting before committing
- Render lists >100 items without virtualization
- Forget data-testid on interactive elements
- Use custom CSS instead of RSuite/TailwindCSS
- Create infinite loops with useEffect (missing dependency array)
- Build UI component from scratch when RSuite has it
- Assume mobile will work without testing

## Invoking This Skill

This skill is active whenever:
- You're working on `carpaintr-front/` code
- You're debugging frontend issues
- You're adding features to the React app
- You're optimizing performance
- You're integrating APIs with the frontend

The skill context will automatically apply these standards and practices to your work.

---

**Last Updated:** 2026-03-25
**Scope:** Autolab Frontend (carpaintr-front)
**Audience:** Senior React/Vite developer with mobile-first performance focus
