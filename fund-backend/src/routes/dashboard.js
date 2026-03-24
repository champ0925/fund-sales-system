const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 产品类型统计（图表用）
router.get('/product-type', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT product_type AS name, COUNT(*) as count
      FROM products
      GROUP BY product_type
    `);
    res.json(rows);
  } catch (err) {
    res.json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;