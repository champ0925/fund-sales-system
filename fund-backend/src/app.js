require('dotenv').config({ 
  path: require('path').resolve(__dirname, '../.env'),
  debug: true 
}); // 👈 最先加载 .env 环境变量（开启调试）
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();

// 更详细的 CORS 配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// MySQL 从 .env 读取配置
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 测试数据库连接
console.log('数据库配置检查:');
console.log('- Host:', process.env.MYSQL_HOST);
console.log('- User:', process.env.MYSQL_USER);
console.log('- Password:', process.env.MYSQL_PASSWORD ? '已设置' : '未设置');
console.log('- Database:', process.env.MYSQL_DATABASE);

db.getConnection()
  .then(connection => {
    console.log('✅ 数据库连接池初始化成功');
    connection.release();
  })
  .catch(err => {
    console.error('❌ 数据库连接池初始化失败:', err.message);
    console.error('错误详情:', err);
  });



// 产品接口 - 获取所有产品
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, product_name, product_type, latest_nav, establish_scale, product_status, DATE_FORMAT(create_time, "%Y-%m-%d %H:%i:%s") as create_time FROM products');
    res.json(rows);
  } catch (err) {
    console.error('产品查询错误:', err.message);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 产品接口 - 新增产品
app.post('/api/products', async (req, res) => {
  try {
    const { product_name, product_type, latest_nav, establish_scale, product_status } = req.body;
    const [result] = await db.query(
      'INSERT INTO products (product_name, product_type, latest_nav, establish_scale, product_status, create_time) VALUES (?, ?, ?, ?, ?, NOW())',
      [product_name, product_type, latest_nav, establish_scale, product_status]
    );
    res.json({ id: result.insertId, message: '新增成功' });
  } catch (err) {
    console.error('产品新增错误:', err.message);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 产品接口 - 编辑产品
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, product_type, latest_nav, establish_scale, product_status } = req.body;
    await db.query(
      'UPDATE products SET product_name = ?, product_type = ?, latest_nav = ?, establish_scale = ?, product_status = ? WHERE id = ?',
      [product_name, product_type, latest_nav, establish_scale, product_status, id]
    );
    res.json({ message: '编辑成功' });
  } catch (err) {
    console.error('产品编辑错误:', err.message);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 产品接口 - 删除产品
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('产品删除错误:', err.message);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 产品接口 - 批量删除产品
app.post('/api/products/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请选择要删除的产品' });
    }
    const placeholders = ids.map(() => '?').join(',');
    await db.query(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
    res.json({ message: '批量删除成功' });
  } catch (err) {
    console.error('产品批量删除错误:', err.message);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 客户路由
const customerRoute = require('./routes/customer');
app.use('/api/customers', customerRoute);

// 客户持有产品路由
const customerHoldRoute = require('./routes/customer-hold');
app.use('/api/customer-hold', customerHoldRoute);

// 跟进记录路由
const followRoute = require('./routes/follow');
app.use('/api/follow', followRoute);

// AI 接口
const aiRoute = require('./routes/aiRoute');
app.use('/api/ai', aiRoute);

// 仪表盘接口
const dashboardRoute = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoute);

const PORT = 3000;
app.listen(PORT, () => {
  console.log('✅ Node 后端运行在 http://localhost:3000');
});