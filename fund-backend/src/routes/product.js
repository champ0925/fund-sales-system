const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 获取产品列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products');
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;