const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyWholeFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat('en-US');

const money = (v) => moneyFmt.format(Number(v) || 0);
const moneyWhole = (v) => moneyWholeFmt.format(Number(v) || 0);
const int = (v) => intFmt.format(Number(v) || 0);
const pct = (v, digits = 1) => `${(Number(v) || 0).toFixed(digits)}%`;

// 'YYYY-MM-DD' -> 'Sep 21'
function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// 'YYYY-MM-DD' -> 'Sep 21, 2026'
function longDate(dateStr) {
  return `${shortDate(dateStr)}, ${dateStr.slice(0, 4)}`;
}

// Accepts a MySQL DATETIME string ('YYYY-MM-DD HH:MM:SS', server local time)
function timeAgo(dateTimeStr, now = new Date()) {
  const then = new Date(dateTimeStr.replace(' ', 'T'));
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

module.exports = { money, moneyWhole, int, pct, shortDate, longDate, timeAgo };
