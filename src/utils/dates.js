// Pure date arithmetic on 'YYYY-MM-DD' strings (UTC-based, so no DST surprises)
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateRange(start, days) {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

module.exports = { addDays, dateRange };
