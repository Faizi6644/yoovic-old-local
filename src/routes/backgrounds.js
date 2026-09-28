const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { SELLER_ID } = require('../config/seller');
const backgrounds = require('../services/backgroundService');

const router = express.Router();

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads', 'backgrounds'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + ALLOWED_TYPES[file.mimetype]),
  }),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    const err = new Error('Only JPG, PNG or WebP images are allowed.');
    err.status = 400;
    cb(err);
  },
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await backgrounds.listBackgrounds(SELLER_ID));
  } catch (err) { next(err); }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose an image to upload.' });
    const label = path.parse(req.file.originalname).name.slice(0, 120) || 'Uploaded image';
    const item = await backgrounds.addBackground(SELLER_ID, { label, filename: req.file.filename });
    res.status(201).json({ item, activeId: item.id });
  } catch (err) { next(err); }
});

router.put('/:id/activate', async (req, res, next) => {
  try {
    const ok = await backgrounds.activateBackground(SELLER_ID, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Background not found.' });
    res.json(await backgrounds.listBackgrounds(SELLER_ID));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await backgrounds.deleteBackground(SELLER_ID, Number(req.params.id));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(await backgrounds.listBackgrounds(SELLER_ID));
  } catch (err) { next(err); }
});

// API errors are returned as JSON rather than the HTML error page
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `Image must be ${MAX_SIZE_MB} MB or smaller.` : err.message;
    return res.status(400).json({ error: message });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = router;
