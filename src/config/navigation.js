// Sidebar structure; `icon` values are Lucide icon names.
// An item with `children` renders as an expandable group; its own slug redirects to the first child.
// A child with `badge: '<source>:<status>'` shows a live count (status 'all' = every row);
// sources are defined in services/navigationService.js. `tone` colours the badge.
module.exports = [
  {
    title: null,
    items: [
      { slug: 'dashboard', label: 'Dashboard', icon: 'house' },
      { slug: 'inventory', label: 'Manage Inventory', icon: 'warehouse' },
      { slug: 'removal-fby-inventory', label: 'Removal FBY Inventory', icon: 'package-minus' },
      { slug: 'profit-calculator', label: 'Profit calculator', icon: 'calculator' },
      {
        slug: 'advertise', label: 'Advertise', icon: 'send',
        children: [
          { slug: 'advertise/campaigns', label: 'Campaigns' },
          { slug: 'advertise/create-campaign', label: 'Create Campaign' },
        ],
      },
      { slug: 'disputes', label: 'Dispute & Appeal Center', icon: 'scale' },
    ],
  },
  {
    title: 'Order management',
    items: [
      {
        slug: 'orders', label: 'Orders', icon: 'clipboard-list',
        children: [
          { slug: 'orders/all', label: 'All', badge: 'orders:all', tone: 'info' },
          { slug: 'orders/pending', label: 'Pending', badge: 'orders:pending', tone: 'info' },
          { slug: 'orders/confirmed', label: 'Confirmed', badge: 'orders:confirmed', tone: 'info' },
          { slug: 'orders/packaging', label: 'Packaging', badge: 'orders:packaging', tone: 'warn' },
          { slug: 'orders/out-for-delivery', label: 'Out For Delivery', badge: 'orders:out_for_delivery', tone: 'warn' },
          { slug: 'orders/delivered', label: 'Delivered', badge: 'orders:delivered', tone: 'good' },
          { slug: 'orders/returned', label: 'Returned', badge: 'orders:returned', tone: 'bad' },
          { slug: 'orders/failed-to-deliver', label: 'Failed To Deliver', badge: 'orders:failed_to_deliver', tone: 'bad' },
          { slug: 'orders/canceled', label: 'Canceled', badge: 'orders:canceled', tone: 'bad' },
        ],
      },
      {
        slug: 'refund-requests', label: 'Refund Requests', icon: 'rotate-ccw',
        children: [
          { slug: 'refund-requests/pending', label: 'Pending', badge: 'refunds:pending', tone: 'bad' },
          { slug: 'refund-requests/approved', label: 'Approved', badge: 'refunds:approved', tone: 'info' },
          { slug: 'refund-requests/refunded', label: 'Refunded', badge: 'refunds:refunded', tone: 'good' },
          { slug: 'refund-requests/rejected', label: 'Rejected', badge: 'refunds:rejected', tone: 'bad' },
        ],
      },
    ],
  },
  {
    title: 'Product management',
    items: [
      {
        slug: 'products', label: 'Products', icon: 'package',
        children: [
          { slug: 'products/add', label: 'Add new product' },
          { slug: 'products/list-by-ypin', label: 'List by YPIN' },
          { slug: 'products/list', label: 'Product List' },
          { slug: 'products/listed-on-ypin', label: 'Product Listed On YPIN' },
          { slug: 'products/approved', label: 'Approved Product List' },
          { slug: 'products/new-requests', label: 'New Product Request' },
          { slug: 'products/denied-requests', label: 'Denied Product Request' },
          { slug: 'products/gallery', label: 'Product Gallery' },
          { slug: 'products/media-library', label: 'Media Library' },
          { slug: 'products/bulk-import', label: 'Bulk import' },
        ],
      },
      { slug: 'create-offers', label: 'Create Offers', icon: 'badge-percent' },
      { slug: 'product-reviews', label: 'Product Reviews', icon: 'star' },
    ],
  },
  {
    title: 'User management',
    items: [
      {
        slug: 'assistants', label: 'Assistants', icon: 'users',
        children: [
          { slug: 'assistants/role-setup', label: 'Assistant Role Setup' },
          { slug: 'assistants/list', label: 'Assistant' },
          { slug: 'assistants/guidelines', label: 'Guidelines To Add Assistant' },
        ],
      },
    ],
  },
  {
    title: 'Promotion management',
    items: [
      { slug: 'coupons', label: 'Coupons', icon: 'ticket' },
      {
        slug: 'marketing', label: 'Marketing', icon: 'megaphone',
        children: [
          { slug: 'marketing/lists', label: 'Lists' },
          { slug: 'marketing/contacts', label: 'Contacts' },
          { slug: 'marketing/campaign', label: 'Campaign' },
          { slug: 'marketing/templates', label: 'Templates' },
          { slug: 'marketing/custom-smtp', label: 'Custom SMTP' },
        ],
      },
    ],
  },
  {
    title: 'Help & support',
    items: [
      { slug: 'inbox', label: 'Inbox', icon: 'messages-square' },
      {
        slug: 'guidelines-policies', label: 'Guidelines & Policies', icon: 'book-open',
        children: [
          { slug: 'guidelines-policies/overview', label: 'Overview' },
          { slug: 'guidelines-policies/warehouse-address', label: 'Warehouse Address' },
          { slug: 'guidelines-policies/tax-guidelines', label: 'Tax Guidelines' },
          { slug: 'guidelines-policies/listing-guidelines', label: 'Listing Guidelines' },
          { slug: 'guidelines-policies/fbm-fby-model', label: 'FBM & FBY Model' },
          { slug: 'guidelines-policies/return-refund-policy', label: 'Return & Refund Policy' },
          { slug: 'guidelines-policies/verified-suppliers', label: 'Verified Suppliers' },
          { slug: 'guidelines-policies/benefits', label: 'Benefits with Yoovic' },
        ],
      },
    ],
  },
  {
    title: 'Reports & analytics',
    items: [
      { slug: 'reports/transactions', label: 'Transactions Report', icon: 'chart-no-axes-column-increasing' },
      { slug: 'reports/products', label: 'Product Report', icon: 'chart-column' },
      { slug: 'reports/orders', label: 'Order Report', icon: 'chart-column-increasing' },
    ],
  },
  {
    title: 'Business section',
    items: [
      { slug: 'withdraws', label: 'Withdraws', icon: 'wallet-cards' },
      { slug: 'bank-information', label: 'Bank Information', icon: 'landmark' },
    ],
  },
  {
    title: null,
    items: [
      { slug: 'reports', label: 'Reports & Exports', icon: 'file-text' },
      { slug: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];
