# 基金销售系统技术设计文档

## 项目概述

本项目是一个基金销售管理系统，采用前后端分离架构，包含 AI 智能问答功能。整个系统由三个子项目组成：fund-agent（AI 智能代理）、fund-backend（Node.js API 服务）和 fund-frontend（React 前端）。

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   fund-frontend │     │   fund-agent    │     │  fund-backend   │
│   (React前端)    │────▶│  (Python AI)    │────▶│   (Node.js)     │
│    端口:5173    │     │   端口:8001     │     │    端口:3000    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   MySQL 数据库   │
                                                └─────────────────┘
```

## 技术栈

### fund-agent（AI 智能代理）

- **框架**: FastAPI
- **语言**: Python 3.x
- **AI 框架**: LangChain + 通义千问（Qwen）
- **数据库**: MySQL + SQLAlchemy
- **主要功能**:
  - 自然语言处理与意图识别
  - 动态 SQL 生成
  - 图表数据生成（支持饼图、柱状图、折线图）
  - 产品新增管理

### fund-backend（后端 API）

- **框架**: Express.js
- **语言**: Node.js
- **数据库**: MySQL（mysql2/promise）
- **主要功能**:
  - 产品管理（CRUD）
  - 客户管理
  - 持仓管理
  - 跟进记录管理

### fund-frontend（前端界面）

- **框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI 组件库**: Ant Design 6.x
- **图表库**: Recharts
- **路由**: React Router DOM
- **HTTP 客户端**: Axios

## 核心模块设计

### AI Agent 核心流程

1. **意图识别**: 解析用户问题，判断查询类型
2. **图表意图**: 判断是否需要生成可视化图表
3. **SQL 生成**: 使用 LLM 将自然语言转换为 SQL
4. **安全执行**: 验证并执行 SQL，返回结果
5. **答案生成**: 将查询结果转换为自然语言回答

### 数据库表结构

- **products**: 产品表（id, product_name, product_type, latest_nav, establish_scale, product_status, create_time）
- **customers**: 客户表（id, customer_name, phone, company, customer_status, create_time）
- **customer_hold**: 持仓表（id, customer_id, product_id, hold_amount, buy_time）
- **customer_follow**: 跟进表（id, customer_id, follow_way, follow_content, follow_time, next_plan）

## 环境配置

### fund-agent 环境变量 (.env)
- `DASHSCOPE_API_KEY`: 通义千问 API 密钥
- `LLM_MODEL`: LLM 模型名称（默认 qwen-turbo）
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`: MySQL 数据库配置

### fund-backend 环境变量 (.env)
- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`: MySQL 数据库配置

## 启动方式

### fund-agent
```bash
cd fund-agent
python main.py
```

### fund-backend
```bash
cd fund-backend
npm install
npm start
```

### fund-frontend
```bash
cd fund-frontend
npm install
npm run dev
```

## API 接口

### fund-agent
- `POST /ai/query`: AI 智能问答接口

### fund-backend
- `GET /api/products`: 获取产品列表
- `POST /api/products`: 新增产品
- `PUT /api/products/:id`: 更新产品
- `DELETE /api/products/:id`: 删除产品
- 其他客户、持仓、跟进接口...

## 安全特性

- AI Agent 端实现了 SQL 注入防护
- 禁止执行 DELETE 操作
- CORS 跨域配置
- 环境变量管理敏感信息
