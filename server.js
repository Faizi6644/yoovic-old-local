require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const navigation = require('./src/config/navigation');
const format = require('./src/utils/format');
const routes = require('./src/routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// Shared template helpers
app.locals.fmt = format;
app.locals.navigation = navigation;
app.locals.year = new Date().getFullYear();

app.use(routes);

app.use((req, res) => {
  res.status(404).render('error', { status: 404, message: 'Page not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const dbDown = ['ECONNREFUSED', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_ACCESS_DENIED_ERROR'].includes(err.code);
  const message = dbDown
    ? 'Cannot reach the database. Start MySQL (XAMPP), check .env, then run "npm run db:setup".'
    : err.message || 'Something went wrong.';
  res.status(err.status || 500).render('error', { status: err.status || 500, message });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Yoovic Seller Central running at http://localhost:${PORT}`));
