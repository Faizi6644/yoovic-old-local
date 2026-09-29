# Yoovic Seller Central

Seller dashboard built with Node.js, Express, EJS and MySQL.

## Setup

1. Start MySQL (XAMPP → Start MySQL).
2. `npm install`
3. Copy `.env.example` to `.env` and adjust credentials if needed (defaults: `root`, no password).
4. `npm run db:setup` – creates the `yoovic_seller` database, tables and demo data.
   The demo week always ends yesterday; re-run any time to reset the data.
5. `npm start` (or `npm run dev` for auto-reload) → http://localhost:3000

## Hero video

The section below the KPI cards plays `public/uploads/Videos/background_video.mp4` (muted, looping, autoplay, no controls). To change it, replace that file with another H.264 MP4. The section is 450px tall on desktop and keeps the video's 16:9 shape on screens under 900px.

## Add New Product (`/products/add`)

A single page with client-side steps: **Page 1 (Basic Info)** → **FBM** or **FBY** page (switchable) → Page 3 (coming soon).
Each page works section by section: only the current section is open, later ones are locked, **Accept & Continue**
validates the section and collapses it to a green check with a summary, and the page's final button unlocks once
every section is accepted. Accepted sections can be reopened; if an edit breaks them they drop back to "needs accepting".

- **Drafts** are saved to MySQL (`product_listings`, `status = 'draft'`, full form state in `data` as JSON) by Save Draft
  and automatically after each accepted section. The draft id is kept in the URL (`?draft=3`), so reloading restores it.
  Existing databases: run `node db/migrate-product-listings.js` once.
- **Images** are uploaded to `public/uploads/products/` (JPG/PNG/WebP, max 5 MB).
- **Mock data** (categories, brands, units, warehouses, media library, FBY fallback inventory, tooltip texts):
  `src/mock/productFormOptions.js`, served by `getFormOptions()` in `src/services/productService.js`.

To connect real APIs: replace `getFormOptions()` on the server, and the functions in `public/js/product-form/api.js`
(drafts + image upload) on the client. Endpoints used today:
`GET/POST /api/products/drafts`, `PUT /api/products/drafts/:id`, `POST /api/products/media` (raw image body).

## Structure

```
server.js                     Express app, error handling
src/config/db.js              MySQL pool (mysql2)
src/config/navigation.js      Sidebar menu
src/routes/index.js           /dashboard + placeholder pages for other menu items
src/routes/products.js        Add New Product page + draft/media API
src/services/dashboardService.js  All dashboard queries → view model
src/services/productService.js    Drafts, image storage, form options
src/mock/productFormOptions.js    Mock data for the product flow
views/                        EJS templates (partials/ = shell)
views/products/               Add New Product: add.ejs, steps/, sections/, components/ (reusable), modals.ejs
public/css/app.css            Theme
public/css/product-form.css   Add New Product styles
public/js/dashboard.js        Chart.js charts
public/js/product-form/       core, api, sections (accordion), editor, uploads, variations, fbm, fby, main
db/schema.sql, db/setup.js    Schema and seed
```
