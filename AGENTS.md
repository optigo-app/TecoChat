<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TecoChat — Project Conventions

## Mobile-Responsive / App-Like Feel (REQUIRED for all UI)

The Next.js version of TecoChat must feel like a native app on mobile, not a
desktop site squished into a phone screen. Every page/component converted from
the old CRA app must follow these rules:

### Viewport & PWA
- `app/layout.tsx` exports a `viewport` with `viewportFit: "cover"`,
  `maximumScale: 1`, `userScalable: false` (no pinch-zoom — app feel).
- A web app manifest (`public/manifest.json`) is linked via `metadata.manifest`
  with `display: standalone` so it can be added to home screen.
- `appleWebApp` metadata is set for iOS standalone mode.

### Safe Areas (notched / rounded displays)
- Use the CSS variables `--safe-top`, `--safe-bottom`, `--safe-left`,
  `--safe-right` (defined in `app/globals.css` from `env(safe-area-inset-*)`)
  on fixed/sticky headers, footers, and full-screen containers.
- Full-screen wrappers use `min-height: 100dvh` (dynamic viewport height) with
  a `100vh` fallback, NOT just `100vh`.

### Breakpoints (STANDARDIZED — replaces old app's inconsistent values)
- The old CRA app used inconsistent breakpoints (480, 599, 600, 768, 769, 900,
  992, 1000, 1200, 1440, 1620). The Next.js version uses a SINGLE consistent
  scale defined in `src/hooks/useIsMobile.ts`:
  - `xs`: 0px (small phone)
  - `sm`: 480px (large phone)
  - `md`: 768px (tablet portrait / large phone landscape)
  - `lg`: 1024px (tablet landscape / small laptop)
  - `xl`: 1440px (desktop)
  - `xxl`: 1920px (large desktop)
- **Mobile-first**: design for `xs` first, then enhance at `md` and `lg`.
- Use `useIsMobile()` (<=768), `useIsTablet()` (<=1024), `useResponsiveLayout()`
  (returns everything), or `useBreakpointDown("md")` / `useBreakpointUp("lg")`.
- Do NOT call MUI's `useMediaQuery` directly with hardcoded strings.
- CSS breakpoints mirror these via `--bp-xs` through `--bp-xxl` CSS vars.

### Responsive Hooks (`src/hooks/useIsMobile.ts`)
- `useIsMobile()` — true when viewport <= 768px.
- `useIsTablet()` — true when viewport <= 1024px.
- `useResponsiveLayout()` — returns `{ width, height, active, isMobile,
  isTablet, isDesktop, isLargeDesktop, isLandscape, isPortrait,
  isKeyboardLikelyOpen }`. Use this instead of multiple useMediaQuery calls.
- `useBreakpointDown(key)` / `useBreakpointUp(key)` — generic breakpoint checks.
- `useSwipe(threshold)` — swipe gesture detection (returns `{ ref, direction,
  distance }`). Attach `ref` to a DOM element; `direction` is "left"/"right"/
  "up"/"down"/null.
- `useOrientation()` — returns "portrait" or "landscape".
- `useDebouncedResize(delay)` — debounced `{ width, height }` for expensive
  computations.

### Fluid Typography (CSS variables + classes)
- Use `.text-fluid-xs` through `.text-fluid-3xl` helper classes, or the CSS
  `clamp()` pattern directly. These smoothly scale between min and max based
  on viewport width (mobile-first).
- Example: `.text-fluid-xl` = `clamp(1.25rem, 2vw + 0.75rem, 1.75rem)` —
  20px at 320px viewport, 28px at 1440px.

### Fluid Spacing (CSS variables)
- `--space-xs` through `--space-2xl` — use `clamp()` to scale spacing with
  viewport. Example: `--space-lg: clamp(1rem, 2vw + 0.5rem, 1.5rem)`.
- Fluid border radius: `--radius-sm` through `--radius-xl`.

### Touch Targets
- Interactive elements must be at least 44x44px (Apple HIG / Material). Use the
  `.tap-target` helper class or `sx={{ minHeight: 48, minWidth: 48 }}`.
- Buttons on mobile: `min-height: 48px`, `font-size: 16px` (prevents iOS
  auto-zoom on focus).
- Input adornment icons (e.g. password eye): use `size="small"` + `edge="end"`
  on IconButton — do NOT force 44px min inside inputs (overflows).

### App-Like Behavior
- `-webkit-tap-highlight-color: transparent` (set on `body` in globals.css) —
  no blue flash on tap.
- `overscroll-behavior-y: none` on body — no rubber-band bounce.
- Hide scrollbars on mobile (`.app-scroll` helper) but keep them on desktop.
- Use `.no-select` on UI chrome (headers, nav, buttons) and `.selectable` on
  content areas (messages, text the user might copy).
- Inputs must be `font-size >= 16px` on mobile to prevent iOS focus zoom
  (enforced globally in globals.css).
- Keyboard detection: `data-keyboard="open"` is set on `<html>` when the
  mobile keyboard opens. Use `.hide-on-keyboard` to hide elements when
  keyboard is open.

### Mobile Components
- `MobileBottomNav` (`src/components/MobileBottomNav/`) — app-like bottom
  navigation bar, hidden on desktop. Supports badges. Use for primary
  navigation on mobile.
- `MobileDrawer` (`src/components/MobileDrawer/`) — slide-out drawer with
  swipe-to-close, backdrop, safe-area support. Renders as docked panel on
  desktop. Use for secondary navigation / details panels on mobile.

### Helper Classes (in `app/globals.css`)
- `.app-shell` — full-height flex column wrapper for a page.
- `.app-header` — sticky top header that respects `--safe-top`.
- `.app-bottom-nav` — sticky bottom nav that respects `--safe-bottom`.
- `.app-scroll` — momentum-scroll container, scrollbars hidden on mobile.
- `.tap-target` — enforces 44x44 min size.
- `.no-select` / `.selectable` — toggles user-select.
- `.mobile-only` / `.tablet-only` / `.desktop-only` — show/hide by breakpoint.
- `.stack-responsive` — column on mobile, row on desktop.
- `.container-responsive` — responsive max-width container.
- `.gap-responsive` / `.pad-responsive` — fluid gap/padding.
- `.h-screen-dvh` / `.min-h-screen-dvh` — dynamic viewport height.
- `.safe-top` / `.safe-bottom` / `.safe-x` / `.safe-y` / `.safe-all` —
  safe-area padding helpers.
- `.text-fluid-xs` through `.text-fluid-3xl` — fluid typography.
- `.truncate` / `.truncate-2` / `.truncate-3` — text truncation.
- `.grid-responsive` — auto-fill grid with min column width.
- `.hide-on-keyboard` — hidden when mobile keyboard is open.
- `.no-pull-refresh` — disables pull-to-refresh on scroll containers.

## Fonts

- **Poppins** is loaded via `<link>` tags in `app/layout.tsx` `<head>`
  (preconnect + stylesheet from Google Fonts, `display=swap`).
- `next/font/google` is NOT used because it fetches font files at build time,
  which fails in restricted-network build environments. The `<link>` approach
  loads at runtime in the user's browser.
- The font stack is centralized as the `--font-family` CSS variable in
  `app/globals.css`. SCSS uses `$font-family` (from `src/global.scss`, which
  maps to the CSS var). MUI uses the literal stack in `src/theme/themes.ts`
  (`poppinsFont` constant) — keep it in sync with `--font-family`.
- Weights loaded: 300, 400, 500, 600, 700.

## Theming (Light + Dark Mode)

- MUI themes: `src/theme/themes.ts` (`getTheme(mode)`), wrapped by
  `src/theme/ThemeRegistry.tsx` which provides `useColorMode()`.
- CSS variables for both modes live in `app/globals.css` under
  `:root`/`[data-theme="light"]` and `[data-theme="dark"]`.
- SCSS variables in `src/global.scss` map to those CSS variables, so every
  SCSS file inherits dark mode automatically. Do NOT hardcode colors in SCSS —
  use the SCSS variables (which resolve to CSS vars).
- A no-flash inline script (`themeNoFlashScript`) sets `data-theme` on `<html>`
  before hydration.
- Persisted choice in `localStorage` key `tecochat-color-mode`; falls back to
  system `prefers-color-scheme`.

## Auth Flow (client-side, preserved from CRA)

- `src/context/LoginData.tsx` — `LoginData` provider + `useLoginContext()`.
  Session in `sessionStorage`; remember-me in cookies (`userData`, `token`).
- `src/components/LoginPage/` — login form (company code → token → SHA1 login).
- `src/components/LoginExists/` — "already logged in elsewhere" page.
- `src/components/AuthGuard.tsx` — client-side session gate for protected
  routes (mirrors old `App.js` session check).
- `proxy.ts` — optimistic redirect: sends remember-me users away from
  `/login`. Authoritative route protection is client-side via `AuthGuard`
  (sessionStorage isn't visible to the server).
- `src/socket.ts` — real Socket.IO client module (replaced stub). Handles
  connection, auth via `auth: { token }`, reconnection (max 5 attempts),
  all event listeners (`internal:msg_receive`, `internal:typing`, etc.),
  all emit functions, Set-based handler registration, and disconnect.
- `src/context/SocketContext.tsx` — React provider wrapping the socket
  lifecycle (connect, disconnect, sessionLogout, 5s status check). Exposes
  `{ status, isConnected, socketId }` via `useSocketContext()`.
- `src/utils/socketHelper.ts` — `registerSocketId()` wrapper.
- `src/utils/versionManager.ts` — version checking, comparison, multi-tab
  sync via BroadcastChannel, SW cleanup.

## App Shell (Sidebar + Header + Layout)

- `src/components/AppLayout/` — wraps pages with Header + Sidebar + content
  area. Manages sidebar collapse state (manual + breakpoint <= 1440px) and
  mobile drawer open state. Content gets `marginLeft` = sidebar width.
- `src/components/Sidebar/` — collapsible sidebar (260px expanded, 76px
  collapsed). Logo + "TeCoChat" title + collapse toggle. Menu items use
  `next/link`. "Powered by" Optigo logo at bottom. localStorage key
  `internal_sidebar_collapsed` persists manual collapse. On mobile (<=768px)
  becomes a slide-in drawer with overlay.
- `src/components/Header/` — fixed top bar. Left: hamburger (mobile) + logo.
  Center: socket status indicator (desktop). Right: theme toggle + profile.
- `src/components/ProfileAvatar/` — "Welcome {username}" text + avatar with
  dropdown menu (Profile, Data Sync, Log out). Logout uses confirmation
  dialog. Avatar colors generated from username hash.
- Sidebar/header/profile all use CSS variables for dark mode support.
  Hover backgrounds use `$hover-bg` / `$hover-bg-strong` SCSS vars (mapped
  to `--color-hover-bg` / `--color-hover-bg-strong` CSS vars).

## Build / Verify

- `npm run build` — typecheck + production build (Turbopack). Run after changes.
- `npx tsc --noEmit` — faster typecheck-only.
- `npm run dev` — dev server.
- MUI Next.js cache provider: import from `@mui/material-nextjs/v16-appRouter`
  (NOT `v13-appRouter` — the package supports v13–v16 export paths; use v16
  for Next.js 16).

