(function () {
  const el = document.getElementById('dashboard-data');
  if (!el || !window.Chart) return;
  const data = JSON.parse(el.textContent);

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7'].map(token);
  const SURFACE = token('--surface');
  const TEXT_2 = token('--text-2');
  const GRID = 'rgba(120, 160, 255, 0.12)';

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const moneyShort = (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : v);

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 10;
  Chart.defaults.color = TEXT_2;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.display = false;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: 'rgba(4, 14, 56, 0.95)',
    borderColor: 'rgba(90, 170, 255, 0.6)',
    borderWidth: 1,
    padding: 8,
    titleColor: '#eef4ff',
    bodyColor: '#eef4ff',
    boxPadding: 4,
    usePointStyle: true,
  });

  const axisX = { grid: { display: false }, border: { color: GRID }, ticks: { color: TEXT_2 } };
  const axisY = (fmt) => ({
    beginAtZero: true,
    grid: { color: GRID },
    border: { display: false },
    ticks: { color: TEXT_2, maxTicksLimit: 5, callback: fmt },
  });

  // Donut with a 2px surface gap between segments
  function donut(id, labels, values, colors, opts = {}) {
    const total = values.reduce((a, b) => a + b, 0);
    return new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: SURFACE, borderWidth: 2, hoverOffset: 3 }] },
      options: {
        cutout: '74%',
        plugins: {
          tooltip: opts.tooltip || {
            callbacks: {
              label: (c) => {
                const pct = total ? ((c.raw / total) * 100).toFixed(1) : 0;
                return ` ${c.label}: ${opts.money ? money.format(c.raw) : c.raw.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ---- Sales & profit trend (single $ axis; orders shown in the tooltip) ----
  const trendCanvas = document.getElementById('trendChart');
  if (trendCanvas) {
    const slice = (days) => data.trend.slice(-days);
    const build = (rows) => ({
      labels: rows.map((r) => r.label),
      datasets: [
        {
          type: 'line', label: 'Net Profit', data: rows.map((r) => r.profit),
          borderColor: SERIES[2], backgroundColor: SERIES[2], borderWidth: 2,
          pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: SERIES[2], pointBorderColor: SURFACE, pointBorderWidth: 2,
          tension: 0.35, order: 0,
        },
        {
          type: 'bar', label: 'Revenue', data: rows.map((r) => r.revenue),
          backgroundColor: SERIES[0], borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'start',
          maxBarThickness: 26, categoryPercentage: 0.7, barPercentage: 0.85, order: 1,
        },
      ],
    });

    let rows = slice(7);
    const trendChart = new Chart(trendCanvas, {
      data: build(rows),
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: axisX, y: axisY(moneyShort) },
        plugins: {
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${money.format(c.raw)}`,
              footer: (items) => `Orders: ${rows[items[0].dataIndex].orders}`,
            },
          },
        },
      },
    });

    document.getElementById('trendRange').addEventListener('change', (e) => {
      rows = slice(Number(e.target.value));
      const next = build(rows);
      trendChart.data.labels = next.labels;
      next.datasets.forEach((ds, i) => { trendChart.data.datasets[i].data = ds.data; });
      trendChart.update();
    });
  }

  // ---- Donuts ----
  donut('orderStatusChart', data.orderStatus.map((d) => d.label), data.orderStatus.map((d) => d.value), SERIES);
  donut('revenueChart', data.revenue.map((d) => d.label), data.revenue.map((d) => d.value), SERIES.slice(0, 5), { money: true });
  donut('customersChart', data.customers.map((d) => d.label), data.customers.map((d) => d.value), [SERIES[0], SERIES[2]]);

  // Stock health: one measure against its remaining track
  const health = Math.round(data.stockHealth * 10) / 10;
  donut('stockChart', ['Healthy', 'Needs attention'], [health, Math.max(0, 100 - health)],
    [SERIES[2], 'rgba(120, 160, 255, 0.16)'],
    { tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toFixed(1)}%` } } });

  // ---- Advertising mini chart (both series in $, single axis) ----
  const adsCanvas = document.getElementById('adsChart');
  if (adsCanvas) {
    new Chart(adsCanvas, {
      data: {
        labels: data.ads.map((d) => d.label),
        datasets: [
          {
            type: 'line', label: 'Attributed Sales', data: data.ads.map((d) => d.sales),
            borderColor: SERIES[2], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
            pointBackgroundColor: SERIES[2], tension: 0.35, order: 0,
          },
          {
            type: 'bar', label: 'Spend', data: data.ads.map((d) => d.spend),
            backgroundColor: SERIES[0], borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'start',
            maxBarThickness: 14, order: 1,
          },
        ],
      },
      options: {
        layout: { padding: { top: 14 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ...axisX, ticks: { color: TEXT_2, font: { size: 8 }, maxRotation: 0, autoSkip: true } },
          y: { ...axisY(moneyShort), ticks: { display: false }, grid: { color: GRID } },
        },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money.format(c.raw)}` } } },
      },
    });
  }
})();
