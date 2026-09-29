const express = require('express');
const navigation = require('../config/navigation');
const { SELLER_ID } = require('../config/seller');
const { getDashboard } = require('../services/dashboardService');
const { getNavBadges } = require('../services/navigationService');
const { getLayoutData } = require('../services/layoutService');

const router = express.Router();

const QUICK_ACTIONS = [
  { label: 'Add New Product', icon: 'package-plus', tone: 'blue', href: '/products/add' },
  { label: 'Create Offer', icon: 'badge-percent', tone: 'green', href: '/create-offers' },
  { label: 'Manage Inventory', icon: 'warehouse', tone: 'indigo', href: '/inventory' },
  { label: 'View Pending Orders', icon: 'clipboard-list', tone: 'red', href: '/orders/pending' },
  { label: 'Create Coupon', icon: 'ticket', tone: 'violet', href: '/coupons' },
  { label: 'Advertise Product', icon: 'megaphone', tone: 'magenta', href: '/advertise/create-campaign' },
  { label: 'Request Withdrawal', icon: 'wallet', tone: 'teal', href: '/withdraws' },
  { label: 'View Disputes', icon: 'life-buoy', tone: 'rose', href: '/disputes' },
  { label: 'View Reviews', icon: 'star', tone: 'orange', href: '/product-reviews' },
  { label: 'Download Reports', icon: 'download', tone: 'sky', href: '/reports' },
];

// Sidebar count badges for every page below
router.use(async (req, res, next) => {
  try {
    res.locals.navBadges = await getNavBadges(SELLER_ID);
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res) => res.redirect('/dashboard'));

// Add New Product flow (page + draft API); registered before the placeholders so it owns /products/add
router.use(require('./products'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await getDashboard(SELLER_ID);
    if (!data) return next(Object.assign(new Error(`Seller #${SELLER_ID} not found. Run "npm run db:setup".`), { status: 404 }));
    res.render('dashboard', { ...data, active: 'dashboard', quickActions: QUICK_ACTIONS });
  } catch (err) {
    next(err);
  }
});

// Parent items with a submenu open their first child
navigation.flatMap((g) => g.items).filter((i) => i.children).forEach((item) => {
  router.get(`/${item.slug}`, (req, res) => res.redirect(`/${item.children[0].slug}`));
});

// Every other sidebar entry renders a placeholder until its module is built
const sections = navigation
  .flatMap((g) => g.items)
  .flatMap((i) => (i.children ? i.children.map((c) => ({ icon: i.icon, title: `${i.label}: ${c.label}`, ...c })) : [i]))
  .filter((i) => i.slug !== 'dashboard');
sections.forEach((item) => {
  router.get(`/${item.slug}`, async (req, res, next) => {
    try {
      res.render('placeholder', { ...(await getLayoutData(SELLER_ID)), item, active: item.slug });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
