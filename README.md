# 基金销售系统项目文档

## 项目概述

基金销售系统是一个完整的基金销售平台，包含前端展示、后端服务和AI智能助手三个主要部分。系统支持基金产品展示、用户管理、交易处理以及基于RAG(检索增强生成)的智能问答功能。

## 系统架构

```
基金销售系统
├── fund-frontend     # 前端应用 (React + TypeScript + Vite)
├── fund-backend      # 后端服务 (Node.js + Express)
└── fund-agent        # AI智能助手 (Python + LangChain)
```

## 技术栈

### 前端 (fund-frontend)
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: React Hooks
- **UI组件**: Ant Design
- **网络请求**: Axios
- **图表**: Recharts

### 后端 (fund-backend)
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: MySQL
- **ORM**: 原生SQL查询
- **认证**: JWT

### AI助手 (fund-agent)
- **语言**: Python 3.9+
- **AI框架**: LangChain
- **向量数据库**: ChromaDB
- **嵌入模型**: DashScope (通义千问)
- **大语言模型**: 通义千问
- **API框架**: FastAPI

## 数据库设计

系统使用MySQL数据库，主要包含以下表：

### 产品表 (products)
- 产品ID、名称、类型、净值、规模、状态等

### 客户表 (customers)
- 客户ID、姓名、电话、公司、状态等

### 客户持仓表 (customer_hold)
- 持仓ID、客户ID、产品ID、持有金额、购买时间

### 跟进记录表 (customer_follow)
- 记录ID、客户ID、跟进方式、内容、时间、下次计划

## RAG模块详解

### 核心组件
1. **文档加载器**: 加载知识库文档
2. **文本分块器**: 将长文档分割成适合检索的文本块
3. **向量存储**: 文档嵌入和向量存储管理
4. **检索器**: 从向量存储中检索相关文档
5. **RAG链**: 核心RAG流程编排

### 知识库内容
- **产品规则**: 基金销售规则、费率、合规要求
- **金融知识**: 股票、基金、债券等金融基础知识

### 工作流程
```
用户问题 → 意图识别 → 知识库检索 → 文档分块 → 向量相似度搜索 → 上下文构建 → LLM生成回答
```

## 前端页面

### 产品货架页面 (Product)
- 基金产品展示
- 产品增删改查
- 产品状态管理

### 客户管理页面 (Customer)
- 客户信息管理
- 客户持仓查看
- 跟进记录管理

### 数据概览页面 (Dashboard)
- 销售数据可视化
- 业绩指标展示
- 图表分析

### AI智能助手页面 (AIAgent)
- 智能问答
- 产品推荐
- 知识查询

## API接口

### 后端API
- `/api/products` - 产品管理
- `/api/customers` - 客户管理
- `/api/customer-hold` - 持仓管理
- `/api/follow` - 跟进记录
- `/api/dashboard` - 仪表盘数据
- `/api/ai` - AI助手接口

### AI助手API
- `/chat` - 智能对话
- `/stream` - 流式响应

## 环境配置

### 前端配置
```bash
VITE_API_URL=http://localhost:3000
```

### 后端配置 (.env)
```bash
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=fund_sales
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

### AI助手配置 (.env)
```bash
LLM_MODEL=qwen-turbo
EMBEDDING_MODEL=text-embedding-v1
RAG_KNOWLEDGE_PATH=./src/rag/knowledge
RAG_PERSIST_DIR=./data/vectorstore
DASHSCOPE_API_KEY=your_api_key
```

## 部署说明

### 前端部署
```bash
cd fund-frontend
npm install
npm run dev
```

### 后端部署
```bash
cd fund-backend
npm install
npm start
```

### AI助手部署
```bash
cd fund-agent
pip install -r requirements.txt
uvicorn main:app --reload
```

## 开发规范

### 前端
- 使用TypeScript严格类型检查
- 组件化开发
- 响应式设计
- 统一的UI风格

### 后端
- RESTful API设计
- 错误处理机制
- 数据库连接池
- 环境变量配置

### AI助手
- 模块化设计
- 配置化参数
- 错误降级处理
- 流式响应支持

## 扩展性

### 前端扩展
- 新增页面组件
- 图表类型扩展
- 主题定制

### 后端扩展
- 新增API接口
- 数据库表扩展
- 中间件集成

### AI助手扩展
- 新文档格式支持
- 新向量数据库接入
- 多语言支持
- 新嵌入模型

## 安全考虑

- 数据库连接安全
- API访问控制
- 敏感信息加密
- 输入验证和过滤

## 性能优化

- 前端代码分割
- 后端数据库索引
- AI助手缓存机制
- 网络请求优化

## 最佳实践

### 开发流程
1. 功能需求分析
2. 数据库设计
3. API接口设计
4. 前端页面开发
5. 集成测试

### 维护建议
1. 定期更新知识库
2. 监控系统性能
3. 用户反馈收集
4. 安全漏洞修复

## 总结

基金销售系统是一个功能完整的基金销售平台，结合了传统Web应用和AI智能助手。系统采用前后端分离架构，具有良好的扩展性和维护性。RAG模块为系统提供了专业的金融知识问答能力，提升了用户体验和系统价值。