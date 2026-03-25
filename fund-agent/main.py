import asyncio
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from src.chain import run_agent, sql_chain, answer_chain, chart_intent_chain, stream_generate, llm
import re

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
                "company": "company",
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
            
            if data:
                chart_data = {'type': 'chart', 'chart': {'type': chart_config.get('chart_type', 'pie'), 'title': chart_config.get('title', '图表'), 'data': data}}
                yield f"data: {json.dumps(chart_data)}\n\n"
                done_data = {'type': 'done', 'content': f'已为您生成{chart_config.get("title", "图表")}'}
                yield f"data: {json.dumps(done_data)}\n\n"
                return
        
        # 2. 生成SQL（流式）
        sql_chunks = []
        for chunk in sql_chain.stream({"question": question}):
            if chunk:
                sql_chunks.append(str(chunk))
                yield f"data: {json.dumps({'type': 'thinking', 'content': '正在生成查询...'})}\n\n"
        
        sql = clean_sql("".join(sql_chunks))
        
        # 空SQL校验
        if not sql or sql.strip() == "":
            finance_keywords = ["基金", "股票", "债券", "货币", "理财", "净值", "收益率", "ETF", "FOF", "LOF", "私募", "公募"]
            is_finance_related = any(kw in question for kw in finance_keywords)
            
            if is_finance_related:
                finance_prompt = f"""你是一个专业的金融理财顾问，请用通俗易懂的语言回答用户的问题。
要求：只输出纯文本，不要使用任何markdown格式（如##、**、-等符号）。
用户问题：{question}

请给出专业但易懂的解答："""
                # 流式输出回答
                answer_chunks = []
                for chunk in llm.stream(finance_prompt):
                    if chunk:
                        answer_chunks.append(str(chunk))
                        yield f"data: {json.dumps({'type': 'content', 'content': ''.join(answer_chunks)})}\n\n"
                        await asyncio.sleep(0.01)
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
            else:
                yield f"data: {json.dumps({'type': 'content', 'content': '抱歉，我无法理解您的问题。我是一个基金数据查询助手，请询问关于产品、客户、持仓等数据库相关的问题。'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
        
        # 3. 执行SQL
        from src.chain import safe_execute_sql
        data, msg = safe_execute_sql(sql)
        
        if data is None:
            yield f"data: {json.dumps({'type': 'content', 'content': msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return
        
        if not data:
            yield f"data: {json.dumps({'type': 'content', 'content': '未查询到数据'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return
        
        # 4. 生成回答（流式）
        yield f"data: {json.dumps({'type': 'thinking', 'content': '正在生成回答...'})}\n\n"
        
        answer_chunks = []
        for chunk in answer_chain.stream({"question": question, "data": str(data)}):
            if chunk:
                answer_chunks.append(str(chunk))
                yield f"data: {json.dumps({'type': 'content', 'content': ''.join(answer_chunks)})}\n\n"
                await asyncio.sleep(0.01)  # 让前端有时间处理
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'type': 'content', 'content': f'服务异常：{str(e)}'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

@app.post("/ai/query")
async def ai_query(data: dict):
    return run_agent(data.get("question", ""))

@app.post("/ai/stream")
async def ai_stream(data: dict):
    """流式响应端点"""
    question = data.get("question", "")
    return StreamingResponse(generate_stream(question), media_type="text/event-stream")

@app.post("/ai/clear")
async def clear_chat():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)