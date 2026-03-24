const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 新增客户持有产品
router.post('/', async (req, res) => {
  try {
    const { customer_id, product_id, hold_amount, buy_time } = req.body;
    const [result] = await pool.query(
      'INSERT INTO customer_hold (customer_id, product_id, hold_amount, buy_time) VALUES (?, ?, ?, ?)',
      [customer_id, product_id, hold_amount, buy_time]
    );
    res.json({ id: result.insertId, message: '新增成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 编辑客户持有产品
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, hold_amount, buy_time } = req.body;
    await pool.query(
      'UPDATE customer_hold SET product_id = ?, hold_amount = ?, buy_time = ? WHERE id = ?',
      [product_id, hold_amount, buy_time, id]
    );
    res.json({ message: '编辑成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除客户持有产品
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM customer_hold WHERE id = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量删除客户持有产品
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请选择要删除的记录' });
    }
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM customer_hold WHERE id IN (${placeholders})`, ids);
    res.json({ message: '批量删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;