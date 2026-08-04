const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ serverTime: new Date().toISOString() });
});

module.exports = router;