const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 获取某个客户的跟进记录
router.get('/customer/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT id, customer_id, follow_way, follow_content, DATE_FORMAT(follow_time, "%Y-%m-%d") as follow_time, next_plan 
      FROM customer_follow WHERE customer_id = ?
    `, [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加跟进记录
router.post('/add', async (req, res) => {
  const { customer_id, follow_way, follow_content, follow_time, next_plan } = req.body;
  try {
    await pool.query(`
      INSERT INTO customer_follow (customer_id, follow_way, follow_content, follow_time, next_plan)
      VALUES (?, ?, ?, ?, ?)
    `, [customer_id, follow_way, follow_content, follow_time, next_plan]);
    res.json({ message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 编辑跟进记录
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { follow_way, follow_content, follow_time, next_plan } = req.body;
    await pool.query(
      'UPDATE customer_follow SET follow_way = ?, follow_content = ?, follow_time = ?, next_plan = ? WHERE id = ?',
      [follow_way, follow_content, follow_time, next_plan, id]
    );
    res.json({ message: '编辑成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除跟进记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM customer_follow WHERE id = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量删除跟进记录
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请选择要删除的记录' });
    }
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM customer_follow WHERE id IN (${placeholders})`, ids);
    res.json({ message: '批量删除成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;