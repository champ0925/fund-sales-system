import asyncio
import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from src.chain import run_agent, sql_chain, answer_chain, chart_intent_chain, stream_generate, llm
import re

# RAG 配置（默认使用 src/rag/knowledge 目录）
current_dir = os.path.dirname(os.path.abspath(__file__))
RAG_KNOWLEDGE_PATH = os.getenv("RAG_KNOWLEDGE_PATH", os.path.join(current_dir, "src", "rag", "knowledge"))
RAG_PERSIST_DIR = os.getenv("RAG_PERSIST_DIR", os.path.join(current_dir, "data", "vectorstore"))

def to_json(data):
    """将数据转换为 UTF-8 编码的 JSON 字符串"""
    return json.dumps(data, ensure_ascii=False)

app = FastAPI(title="Fund AI Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_sql(sql: str) -> str:
    """清洗LLM输出的SQL"""
    import re
    sql = sql.strip()
    sql = re.sub(r'^```sql', '', sql)
    sql = re.sub(r'^```', '', sql)
    sql = re.sub(r'```$', '', sql)
    sql = re.sub(r'^(SQL|sql)[:：]\s*', '', sql)
    return sql.strip()

def parse_chart_intent(question: str):
    """流式解析图表意图"""
    result_chunks = []
    for chunk in chart_intent_chain.stream({"question": question}):
        if chunk:
            result_chunks.append(str(chunk))
    result = "".join(result_chunks)
    result = result.strip()
    result = re.sub(r'^```json', '', result)
    result = re.sub(r'^```', '', result)
    result = re.sub(r'```$', '', result)
    try:
        data = json.loads(result.strip())
        return data if data.get("need_chart") else None
    except:
        return None

async def generate_stream(question: str):
    """流式生成回答"""
    try:
        # 1. 图表意图解析
        chart_config = parse_chart_intent(question)
        if chart_config:
            # 生成图表SQL
            field_mapping = {
                "product_type": "product_type",
                "product_status": "product_status",
                "product_name": "product_name",
            }
            group_by = chart_config.get("group_by", "product_type")
            value_field = chart_config.get("value_field", "count")
            db_field = field_mapping.get(group_by, group_by)
            
            if value_field == "count":
                value_sql = "COUNT(*) as value"
            elif value_field == "latest_nav":
                value_sql = "AVG(latest_nav) as value"
            elif value_field == "establish_scale":
                value_sql = "SUM(establish_scale) as value"
            else:
                value_sql = "COUNT(*) as value"
            
            sql = f"SELECT {db_field} as name, {value_sql} FROM products GROUP BY {db_field}"
            
            from src.chain import safe_execute_sql
            data, msg = safe_execute_sql(sql)
            
            # 图表生成：直接返回完整数据，不走流式
            if data:
                result = {
                    'type': 'chart',
                    'chart': {
                        'type': chart_config.get('chart_type', 'pie'),
                        'title': chart_config.get('title', '图表'),
                        'data': data
                    },
                    'answer': f'已为您生成{chart_config.get("title", "图表")}'
                }
                yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"
                return
            else:
                yield f"data: {json.dumps({'type': 'content', 'content': msg}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

        # 1.5 RAG 意图判断（知识库查询）
        from src.rag.chain import is_rag_question, rag_stream

        # 数据库表相关关键词 - 这些问题走SQL查询，不走RAG
        db_keywords = ["产品", "客户", "持仓", "跟进", "销售额", "业绩", "公司", "姓名", "电话", "运作", "募集", "清盘"]

        print(f"[DEBUG] 问题: {question}")
        print(f"[DEBUG] RAG知识库路径: {RAG_KNOWLEDGE_PATH}, 存在: {os.path.exists(RAG_KNOWLEDGE_PATH)}")

        # 判断是否涉及数据库查询
        is_db_query = any(kw in question for kw in db_keywords)

        # 判断是否应该走RAG：必须不涉及数据库查询，且RAG意图为True
        is_rag = is_rag_question(question)
        should_use_rag = is_rag and not is_db_query

        print(f"[DEBUG] 数据库查询: {is_db_query}, RAG意图: {is_rag}, 最终: {should_use_rag}")

        if should_use_rag and os.path.exists(RAG_KNOWLEDGE_PATH):
            print("[DEBUG] 触发RAG意图（知识库检索）")
            yield f"data: {json.dumps({'type': 'thinking', 'content': '正在检索知识库...'}, ensure_ascii=False)}\n\n"
            # RAG 流式回答
            for chunk in rag_stream(
                question=question,
                knowledge_path=RAG_KNOWLEDGE_PATH,
                persist_directory=RAG_PERSIST_DIR,
                k=4
            ):
                if chunk:
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return
        else:
            print("[DEBUG] 未触发RAG意图，走SQL查询")

        # 2. 生成SQL（流式）
        sql_chunks = []
        for chunk in sql_chain.stream({"question": question}):
            if chunk:
                sql_chunks.append(str(chunk))
                yield f"data: {json.dumps({'type': 'thinking', 'content': '正在生成查询...'}, ensure_ascii=False)}\n\n"
        
        sql = clean_sql("".join(sql_chunks))
        
        # 空SQL校验 - 金融问题已在RAG阶段处理，此处只处理数据库查询
        if not sql or sql.strip() == "":
            yield f"data: {json.dumps({'type': 'content', 'content': '抱歉，我无法理解您的问题。我是一个基金数据查询助手，请询问关于产品、客户、持仓等数据库相关的问题。'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return

        # 3. 执行SQL
        from src.chain import safe_execute_sql
        from datetime import datetime

        print(f"[DEBUG] 生成的SQL: {sql}")
        data, msg = safe_execute_sql(sql)
        print(f"[DEBUG] SQL执行结果: data={data}, msg={msg}")

        # 格式化数据，处理Timestamp等特殊类型
        if data and isinstance(data, list):
            formatted_data = []
            for item in data:
                formatted_item = {}
                for k, v in item.items():
                    if hasattr(v, 'strftime'):
                        # 处理datetime和Timestamp
                        try:
                            formatted_item[k] = v.strftime("%Y-%m-%d")
                        except:
                            formatted_item[k] = str(v)
                    else:
                        formatted_item[k] = str(v) if v is not None else ""
                formatted_data.append(formatted_item)
            data = formatted_data

        if data is None:
            yield f"data: {json.dumps({'type': 'content', 'content': msg}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return

        # 处理INSERT/UPDATE成功的情况（返回True）
        if data is True:
            yield f"data: {json.dumps({'type': 'content', 'content': msg}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return

        if not data:
            yield f"data: {json.dumps({'type': 'content', 'content': '未查询到数据'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return
        
        # 4. 直接格式化数据返回（避免LLM流式输出的累积问题）
        # 判断是否为简单的数据查询列表
        if data and isinstance(data, list) and len(data) > 0:
            # 直接格式化数据为易读的形式
            formatted_lines = []
            first_item = data[0]

            # 判断查询类型并格式化
            if "product_name" in first_item and "hold_amount" in first_item:
                # 持仓查询结果
                title = "持仓情况"
                for i, item in enumerate(data, 1):
                    line = f"{i}. **{item.get('customer_name', '')}** 持有 **{item.get('product_name', '')}**，金额：{item.get('hold_amount', '')}万元，购买时间：{item.get('buy_time', '')}"
                    formatted_lines.append(line)
            elif "customer_name" in first_item and "phone" in first_item:
                # 客户信息
                title = "客户信息"
                for i, item in enumerate(data, 1):
                    line = f"{i}. **{item.get('customer_name', '')}**，电话：{item.get('phone', '')}，公司：{item.get('company', '')}，状态：{item.get('customer_status', '')}"
                    formatted_lines.append(line)
            elif "product_name" in first_item and "product_type" in first_item:
                # 产品信息
                title = "产品信息"
                for i, item in enumerate(data, 1):
                    line = f"{i}. **{item.get('product_name', '')}**，类型：{item.get('product_type', '')}，净值：{item.get('latest_nav', '')}，状态：{item.get('product_status', '')}"
                    formatted_lines.append(line)
            else:
                # 通用格式化
                title = "查询结果"
                for i, item in enumerate(data, 1):
                    line = f"{i}. " + "，".join([f"{k}：{v}" for k, v in item.items()])
                    formatted_lines.append(line)

            answer_text = f"根据查询到的数据，以下是{title}：\n\n" + "\n".join(formatted_lines)
            yield f"data: {json.dumps({'type': 'content', 'content': answer_text}, ensure_ascii=False)}\n\n"
        else:
            # 无法直接格式化，走LLM
            yield f"data: {json.dumps({'type': 'thinking', 'content': '正在生成回答...'}, ensure_ascii=False)}\n\n"
            answer_chunks = []
            for chunk in answer_chain.stream({"question": question, "data": str(data)}):
                if chunk:
                    chunk_str = str(chunk)
                    answer_chunks.append(chunk_str)
                    yield f"data: {json.dumps({'type': 'content', 'content': ''.join(answer_chunks)}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.01)

        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        error_msg = f'服务异常：{str(e)}'
        print(f"[ERROR] {error_msg}")
        print(f"[TRACE] {error_detail}")
        yield f"data: {json.dumps({'type': 'content', 'content': error_msg}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

@app.post("/ai/query")
async def ai_query(data: dict):
    return run_agent(data.get("question", ""))

@app.post("/ai/stream")
async def ai_stream(data: dict):
    """流式响应端点"""
    question = data.get("question", "")
    
    async def encode_stream():
        """将字符串流转换为 UTF-8 字节流"""
        async for chunk in generate_stream(question):
            if isinstance(chunk, str):
                yield chunk.encode('utf-8')
            elif isinstance(chunk, bytes):
                yield chunk
            else:
                yield str(chunk).encode('utf-8')
    
    return StreamingResponse(
        encode_stream(),
        media_type="text/event-stream",
        headers={"Content-Type": "text/event-stream; charset=utf-8"}
    )

@app.post("/ai/clear")
async def clear_chat():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)