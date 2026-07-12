# DECISIONS.md — Atlas Inventory → Web E-commerce Platform

Assumptions and professional choices made while transforming Atlas Inventory
into a unified public landing + storefront + admin platform. Each entry says
what was decided and why.

## Phase 0 — Skills

- The requested community skills (`taste-skill`, `ui-ux-pro-max`, `impeccable`)
  plus the built-in `frontend-design` skill were **already installed** in the
  working environment, so they were loaded directly instead of re-installed via
  `npx skills add`. `ui-animation` / `css-animations` have no exact package;
  their coverage (motion discipline, reduced-motion, easing guidance) is part
  of the loaded skills and was applied.
- The skills' React/Next examples were translated to Vue/Nuxt idioms (CSS
  keyframe orchestration instead of Framer Motion), since the project is Nuxt 4.

## Phase 1 — Electron removal

- **The repo was already a pure web app** (Nuxt 4 + NuxtHub on Cloudflare
  Pages). No Electron dependency, process file, or IPC call existed; the only
  `electron` matches are the word “Electronics” (a product category name).
  Phase 1 was therefore verification, not migration.

## Phase 2 — Architecture

- All existing admin pages moved from `/` to `/admin/**` (git-mv, history
  preserved). The dashboard is now `/admin`, and the public landing owns `/`.
- Layout selection is route-based in `app.vue`: `/admin/**` → `admin` layout
  (existing sidebar shell), everything else → `default` (storefront shell).
  Auth pages keep `layout: false`.
- **No redirects from the old URLs** (`/products` → `/admin/products`): the app
  was an internal tool, old bookmarks are minor, and silent redirects would
  shadow future public routes.
- Client route guard: public by default; `/admin/**` requires a session;
  `/admin/users` requires the `admin` role. Server middleware unchanged except
  `/api/shop/**` is public (see Phase 6) — viewers stay read-only because the
  role check still applies to all other write endpoints.

## Phase 3 — Media on Cloudflare R2

- **NuxtHub blob is the storage driver** instead of hand-rolled S3 presigned
  URLs. Rationale: the project already deploys through NuxtHub to Cloudflare
  Pages; the `BLOB` R2 binding authenticates the Worker directly (no static
  `R2_*` keys to leak), and the local-disk fallback for development
  (`.data/hub/blob`) comes built in — exactly the fallback the brief required.
- Uploads go through the authenticated API (`POST /api/products/:id/media`,
  multipart) rather than presigned browser→R2 PUTs. At this shop's scale the
  Worker hop is negligible, and it lets the server enforce MIME/size rules
  (images ≤ 8 MB: jpeg/png/webp/gif/avif; documents ≤ 25 MB: PDF only).
- Objects are keyed `products/<productId>/<random>-<safe-name>` and served
  from `/media/*` with `Cache-Control: public, max-age=31536000, immutable`
  (keys contain a random component, so they never need invalidation).
- **Responsive variants**: R2 does not resize images. Instead of shipping a
  broken `/cdn-cgi/image/` integration that 404s on zones without Image
  Resizing, images ship with `loading="lazy"`, `decoding="async"`, fixed
  aspect-ratio containers (no CLS) and long-lived caching. If the production
  zone enables Cloudflare Image Resizing later, a URL-prefix helper is a
  one-file change.

## Phase 4 — Product model

- New columns on `products`: `slug` (unique index), `brand`, `specs` (JSON
  key/value list), `related_products` (JSON id array), `published`,
  `published_at`. Media lives in a new `media_assets` table (ordered gallery +
  PDF documents). Categories also gained a `slug` for `/category/[slug]`.
- Slugs transliterate French accents **and Arabic** so product names in any
  shop language produce shareable URLs. Slugs stay stable on rename (URL
  stability beats cosmetic freshness); they are backfilled by `/api/__migrate`.
- `related_products` is a JSON column, not a join table: the list is small
  (≤ 12), ordered, and only read on the product page.
- Migrations follow the repo's existing two-track convention: idempotent
  `/api/__migrate` endpoint (dev/local) + dated SQL file in `migrations/`
  (remote D1 via wrangler).

## Phase 5 — Excel import

- The `.xlsx` is parsed **in the browser** (SheetJS from the official CDN
  build 0.20.3, since the npm registry copy is stale) so the preview +
  per-row validation is instant and free of server round-trips. Valid rows
  are then sent in batches of 10.
- `image_paths` / `technical_file_paths` entries that are URLs are downloaded
  **server-side** into R2. Entries that are local paths cannot be read by a
  web server (browser sandbox), so the importer lets the admin drop the
  referenced files next to the sheet and matches them **by file name**; the
  match count is shown before import. Unmatched paths are reported per row.
- Rows match existing products by SKU first, then case-insensitive exact
  name; matched rows update, others create. Missing categories are
  auto-created (reported as such). Errors never block valid rows.
- Related products are linked by SKU in a second pass, so rows can reference
  SKUs created later in the same file.

## Phase 6 — Storefront

- Public API namespace `/api/shop/**` returns dedicated DTOs that **never
  include** cost price, margin, supplier data, or internal notes.
- Cart lives in `localStorage` (`atlas-cart-v1`) via a Pinia store; prices are
  always recomputed server-side at checkout, so a stale cart can't order at an
  old price.
- Checkout has no online payment (per brief): name + phone (normalized to
  E.164 with the configurable default country code, default +213) + optional
  note. A honeypot field rejects naive bots. Orders land as `web_orders`
  with status flow `new → confirmed → delivered / cancelled`.
- **Stock is decremented when an admin confirms the order** (not at
  placement, per brief) with full `stock_movements` audit entries; cancelling
  a confirmed order restocks. Confirmation is all-or-nothing with a 409 +
  per-item detail on insufficient stock.
- Best sellers = confirmed-sale quantities; products without sales history
  fall back to newest published so the section is never empty.

## Phase 7 — Landing

- Design tokens: ink `#0E1420` on cool white, **one cobalt accent**
  (`#2340E0` family), six rotating pastel tile tints (deterministic per
  product id), radius scale 20–28 px, Space Grotesk (display) + DM Sans
  (body) + Tajawal (Arabic, both roles), self-hosted via `@nuxt/fonts` with
  metric-adjusted fallbacks.
- The hero is an asymmetric split: copy left, a pastel “stage” right showing a
  real best-selling product with floating name/price/stock chips. The load
  animation is a CSS-only orchestration (copy rises staggered → stage scales
  in → chips pop) fully disabled under `prefers-reduced-motion`.
- All landing sections read live data from `/api/shop/home` (one round trip).
  The repairs section is static copy by design — repair offerings are not
  modeled as storefront data.

## Phase 8 — Admin

- WhatsApp buttons are **pure `wa.me` deep links** built client-side from the
  normalized phone (no webhooks, no API). Invalid numbers render a disabled
  button with an explanatory tooltip. The default country code is configurable
  in Settings → Online store.
- “Copy link” buttons use `navigator.clipboard.writeText` with a success
  toast; they are disabled (with tooltip) for unpublished products since the
  public URL would 404. The base URL is `settings.siteUrl`, falling back to
  the current origin.
- Storefront fields (publish state, gallery, PDFs, brand, specs, related
  picker) live in a dedicated panel on the product page and save through
  `PUT /api/products/:id/storefront`, which touches **only** storefront
  columns — a partial write through the general product PUT would have
  wiped unrelated fields.
- Converting a web order to a sale requires the order to be confirmed first
  (stock already moved), then creates a **confirmed, unpaid** sale linked to a
  customer found-or-created by phone; the open amount goes on the customer
  balance, entering the existing credit/partial-payment flow unchanged.
  Once converted, the order is managed from the sale (its own status buttons
  lock) so stock can never be double-counted.
- Gallery reordering uses explicit move buttons instead of a drag-and-drop
  library: no new dependency, keyboard-accessible, and touch-friendly.
  File *upload* does support drag-and-drop.

## Phase 9 — Quality

- SEO: per-page `useSeoMeta`, OpenGraph with product image + JSON-LD
  `Product`/`Offer` (price, currency, availability) for rich link previews,
  canonical URLs from `settings.siteUrl`, `/sitemap.xml` generated from
  published products/categories, robots.txt excludes admin/auth/cart/checkout.
- i18n: every new surface (storefront, orders module, import, settings) is
  translated in French, English, and Arabic; RTL handled via logical
  utilities (`ltr:`/`rtl:`) and the existing `dir` switching.
- DZD prices render as “12 500 DA” / “دج” rather than `Intl`'s awkward
  DZD output; other currencies use standard `Intl` formatting.

## Test data

- A `claude-test@example.com` admin user (password `AtlasTest123!`) was added
  to the **local dev database only** for automated UI testing — delete it if
  unwanted (`DELETE FROM users WHERE id = 'user_claude_test'`). Four seeded
  products were published with placeholder photos (picsum.photos) to exercise
  the storefront; replace them with real product photography via the media
  manager or the Excel importer.
