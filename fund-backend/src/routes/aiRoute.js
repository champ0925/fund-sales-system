const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    const resp = await axios.post('http://localhost:8001/ai/query', {
      question
    });
    // 直接返回 Agent 的响应，包括可能的 chart 数据
    res.json(resp.data);
  } catch (err) {
    res.json({ answer: 'AI 服务异常' });
  }
});

module.exports = router;