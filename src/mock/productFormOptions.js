// Mock option lists for the Add New Product flow.
// Shaped like the future API responses; replace getFormOptions() in productService.js to go live.

const categories = [
  {
    id: 'fragrances', name: 'Fragrances & Perfumes',
    children: [
      { id: 'womens-fragrance', name: "Women's Fragrance", children: [
        { id: 'eau-de-parfum', name: 'Eau de Parfum' },
        { id: 'eau-de-toilette', name: 'Eau de Toilette' },
        { id: 'body-mist', name: 'Body Mist' },
      ] },
      { id: 'mens-fragrance', name: "Men's Fragrance", children: [
        { id: 'mens-edp', name: 'Eau de Parfum' },
        { id: 'cologne', name: 'Cologne' },
      ] },
    ],
  },
  {
    id: 'beauty', name: 'Beauty & Personal Care',
    children: [
      { id: 'hair-care', name: 'Hair Care', children: [
        { id: 'shampoo', name: 'Shampoo' },
        { id: 'conditioner', name: 'Conditioner' },
        { id: 'hair-oil', name: 'Hair Oil' },
      ] },
      { id: 'skin-care', name: 'Skin Care', children: [
        { id: 'moisturizer', name: 'Moisturizer' },
        { id: 'serum', name: 'Serum' },
        { id: 'sunscreen', name: 'Sunscreen' },
      ] },
    ],
  },
  {
    id: 'electronics', name: 'Electronics',
    children: [
      { id: 'audio', name: 'Audio', children: [
        { id: 'earbuds', name: 'Wireless Earbuds' },
        { id: 'headphones', name: 'Headphones' },
        { id: 'speakers', name: 'Speakers' },
      ] },
      { id: 'mobile-accessories', name: 'Mobile Accessories', children: [
        { id: 'chargers', name: 'Chargers & Cables' },
        { id: 'cases', name: 'Phone Cases' },
      ] },
    ],
  },
  {
    id: 'fashion', name: 'Fashion',
    children: [
      { id: 'womens-clothing', name: "Women's Clothing", children: [
        { id: 'dresses', name: 'Dresses' },
        { id: 'tops', name: 'Tops' },
      ] },
      { id: 'mens-clothing', name: "Men's Clothing", children: [
        { id: 'shirts', name: 'Shirts' },
        { id: 't-shirts', name: 'T-Shirts' },
      ] },
    ],
  },
];

const brands = [
  { id: 'chanel', name: 'Chanel' },
  { id: 'dior', name: 'Dior' },
  { id: 'gucci', name: 'Gucci' },
  { id: 'loreal', name: "L'Oréal" },
  { id: 'nivea', name: 'Nivea' },
  { id: 'apple', name: 'Apple' },
  { id: 'samsung', name: 'Samsung' },
  { id: 'nike', name: 'Nike' },
  { id: 'generic', name: 'Generic' },
];

const units = ['Piece', 'Bottle', 'Box', 'Pack', 'Pair', 'Set', 'Kg', 'Gram', 'Litre', 'ml'];

const shippingTimes = ['1–2 Days', '2–3 Days', '3–5 Days', '5–7 Days', '7–14 Days'];
const handlingTimes = ['Same Day', '1–2 Days', '2–3 Days', '3–5 Days'];
const backorderOptions = [
  { value: 'not_allowed', label: 'Not Allowed' },
  { value: 'allow', label: 'Allow' },
];

// Attributes offered in the Add Variations dialog
const variationAttributes = [
  { name: 'Size', suggestions: ['50 ml', '100 ml', '200 ml', 'S', 'M', 'L', 'XL'] },
  { name: 'Color', suggestions: ['Beige', 'Pink', 'White', 'Black', 'Blue', 'Red'] },
  { name: 'Material', suggestions: ['Glass', 'Plastic', 'Cotton', 'Leather'] },
  { name: 'Style', suggestions: ['Classic', 'Modern', 'Sport'] },
];

const packagingTypes = ['Carton', 'Poly Mailer', 'Bubble Mailer', 'Pallet', 'Crate'];

const warehouses = [
  {
    id: 'us-chicago', name: 'Yoovic US Fulfillment Center',
    address: '123 Logistics Drive, Chicago, IL 60601, USA',
    receivingHours: 'Mon - Fri, 9:00 AM - 5:00 PM',
    instructions: 'Pallets and cartons must be labeled.',
  },
  {
    id: 'ae-dubai', name: 'Yoovic UAE Fulfillment Center',
    address: 'Plot 45, Jebel Ali Free Zone, Dubai, UAE',
    receivingHours: 'Sun - Thu, 8:00 AM - 6:00 PM',
    instructions: 'Book a delivery slot 24 hours in advance.',
  },
  {
    id: 'uk-london', name: 'Yoovic UK Fulfillment Center',
    address: 'Unit 7, Heathrow Logistics Park, London TW6 2GD, UK',
    receivingHours: 'Mon - Fri, 8:00 AM - 4:00 PM',
    instructions: 'Each carton needs a printed box barcode.',
  },
];

const arrivalWindows = ['9:00 AM – 12:00 PM', '12:00 PM – 3:00 PM', '9:00 AM – 5:00 PM', '3:00 PM – 6:00 PM'];

// Images available under "From Library"
const mediaLibrary = [
  { id: 'lib-1', url: '/images/mock/perfume-beige.svg', name: 'Perfume – Beige' },
  { id: 'lib-2', url: '/images/mock/perfume-pink.svg', name: 'Perfume – Pink' },
  { id: 'lib-3', url: '/images/mock/perfume-white.svg', name: 'Perfume – White' },
  { id: 'lib-4', url: '/images/mock/perfume-box.svg', name: 'Perfume – Gift Box' },
  { id: 'lib-5', url: '/images/mock/perfume-lifestyle.svg', name: 'Perfume – Lifestyle' },
  { id: 'lib-6', url: '/images/mock/perfume-banner.svg', name: 'Perfume – Banner (2:1)' },
];

// FBY Page 3: handling categories (icon = Lucide name, tone = icon colour)
const handlingCategories = [
  { id: 'standard', label: 'Standard / General Product', icon: 'package', tone: 'blue' },
  { id: 'fragile', label: 'Fragile / Glass', icon: 'wine', tone: 'blue' },
  { id: 'liquid', label: 'Liquid', icon: 'droplet', tone: 'blue' },
  { id: 'hazardous', label: 'Hazardous / Dangerous Goods', icon: 'triangle-alert', tone: 'red' },
  { id: 'flammable', label: 'Flammable', icon: 'flame', tone: 'red' },
  { id: 'aerosol', label: 'Aerosol / Pressurized', icon: 'spray-can', tone: 'blue' },
  { id: 'battery', label: 'Battery / Lithium Battery', icon: 'battery-charging', tone: 'blue' },
  { id: 'magnetic', label: 'Magnetic', icon: 'magnet', tone: 'blue' },
  { id: 'perishable', label: 'Perishable', icon: 'apple', tone: 'blue' },
  { id: 'temperature', label: 'Temperature Controlled', icon: 'thermometer', tone: 'blue' },
  { id: 'oversized', label: 'Oversized / Heavy', icon: 'weight', tone: 'blue' },
  { id: 'sharp', label: 'Sharp / Breakable', icon: 'scissors', tone: 'blue' },
  { id: 'high-value', label: 'High-Value / Extra Security', icon: 'shield-check', tone: 'blue' },
  { id: 'regulated', label: 'Regulated / Restricted', icon: 'badge-alert', tone: 'blue' },
  { id: 'other', label: 'Other Special Handling', icon: 'circle-ellipsis', tone: 'blue' },
];

// Yoovic Shipping mock rates: base + perKg × total kg + perBox × boxes (no carrier API yet)
const yoovicCarriers = [
  { id: 'ups', name: 'UPS', service: 'Ground', delivery: '3–5 Days', base: 6.5, perKg: 0.55, perBox: 1.2, color: '#7a4a1e' },
  { id: 'fedex', name: 'FedEx', service: 'Ground', delivery: '3–5 Days', base: 6.9, perKg: 0.58, perBox: 1.1, color: '#4d148c' },
  { id: 'dhl', name: 'DHL', service: 'Express', delivery: '1–3 Days', base: 12, perKg: 0.9, perBox: 2, color: '#d40511' },
  { id: 'usps', name: 'USPS', service: 'Priority', delivery: '2–4 Days', base: 7.5, perKg: 0.62, perBox: 0.9, color: '#004b87' },
];

// Carriers a seller can book themselves (Self-Arranged Shipping)
const selfCarriers = ['UPS', 'FedEx', 'DHL', 'USPS', 'Aramex', 'Other'];

// Used for FBY "Current Inventory" when the seller left FBM quantities empty
const mockCurrentInventory = [200, 300, 80, 150, 120, 90];

// Tooltip text for the ⓘ icons
const tips = {
  brand: "Choose the brand printed on the product. Pick 'Generic' if it has no brand.",
  sellerSku: 'Your own unique code for this product. It appears on orders and reports.',
  shippingMultiply: 'When ticked, the shipping cost is charged once per unit ordered instead of once per order.',
  expressShipping: 'Optional faster delivery option offered to buyers at checkout.',
  lowStockAlert: "You'll get a notification when available quantity drops to this number.",
  fbySelect: 'Tick each variation you are sending and enter how many units are in the shipment.',
  selectedVariations: 'Number of variations included in this shipment out of all variations.',
  packingMethod: 'Choose whether every box holds the same number of items or each box is different.',
  packagingType: 'The outer packaging your items arrive in at the warehouse.',
  individualPackaging: 'Is each unit individually wrapped or boxed inside the carton?',
  useMaster: 'A master carton is a larger carton that holds several of your shipment boxes.',
  masterCount: 'Total master cartons in this shipment.',
  masterBoxes: 'How many shipment boxes fit inside each master carton.',
  warehouse: 'The Yoovic fulfillment center that will receive and store your inventory.',
  arrival: 'Helps the warehouse plan receiving. Shipments are accepted during receiving hours only.',
  variationBreakdown: 'Boxes and units per variation, based on your packing choices.',
};

module.exports = {
  categories, brands, units, shippingTimes, handlingTimes, backorderOptions, variationAttributes,
  packagingTypes, warehouses, arrivalWindows, mediaLibrary, mockCurrentInventory, tips,
  handlingCategories, yoovicCarriers, selfCarriers,
};
