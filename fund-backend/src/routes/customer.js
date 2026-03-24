const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 获取客户列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增客户
router.post('/', async (req, res) => {
  try {
    const { customer_name, phone, company, customer_status } = req.body;
    const [result] = await pool.query(
      'INSERT INTO customers (customer_name, phone, company, customer_status, create_time) VALUES (?, ?, ?, ?, NOW())',
      [customer_name, phone, company, customer_status]
    );
    res.json({ id: result.insertId, message: '新增成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 编辑客户
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, phone, company, customer_status } = req.body;
    await pool.query(
      'UPDATE customers SET customer_name = ?, phone = ?, company = ?, customer_status = ? WHERE id = ?',
      [customer_name, phone, company, customer_status, id]
    );
    res.json({ message: '编辑成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除客户
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量删除客户
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请选择要删除的客户' });
    }
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM customers WHERE id IN (${placeholders})`, ids);
    res.json({ message: '批量删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 查询客户持有产品
router.get('/:id/products', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT ch.id, ch.customer_id, ch.product_id, ch.hold_amount, DATE_FORMAT(ch.buy_time, "%Y-%m-%d") as buy_time,
             p.product_name, p.product_type
      FROM customer_hold ch
      JOIN products p ON ch.product_id = p.id
      WHERE ch.customer_id = ?
    `, [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;