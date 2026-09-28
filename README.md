# Yoovic Seller Central

Seller dashboard built with Node.js, Express, EJS and MySQL.

## Setup

1. Start MySQL (XAMPP → Start MySQL).
2. `npm install`
3. Copy `.env.example` to `.env` and adjust credentials if needed (defaults: `root`, no password).
4. `npm run db:setup` – creates the `yoovic_seller` database, tables and demo data.
   The demo week always ends yesterday; re-run any time to reset the data.
5. `npm start` (or `npm run dev` for auto-reload) → http://localhost:3000

## Hero background

Click **Background** (bottom-right of the hero) to open the picker on the right. From there you can switch between saved images, upload a new one (JPG/PNG/WebP, max 5 MB, click or drag & drop) or delete uploads. The choice is stored per seller in MySQL (`hero_backgrounds`, `sellers.hero_background_id`); uploads go to `public/uploads/backgrounds/`. The built-in image `public/images/hero-bg.jpg` cannot be deleted.

API: `GET /api/backgrounds`, `POST /api/backgrounds` (multipart field `image`), `PUT /api/backgrounds/:id/activate`, `DELETE /api/backgrounds/:id`.

## Structure

```
server.js                     Express app, error handling
src/config/db.js              MySQL pool (mysql2)
src/config/navigation.js      Sidebar menu
src/routes/index.js           /dashboard + placeholder pages for other menu items
src/routes/backgrounds.js     Hero background API (upload via multer)
src/services/backgroundService.js  Background queries
public/js/backgrounds.js      Background picker drawer
src/services/dashboardService.js  All dashboard queries → view model
views/                        EJS templates (partials/ = shell)
public/css/app.css            Theme
public/js/dashboard.js        Chart.js charts
db/schema.sql, db/setup.js    Schema and seed
```
