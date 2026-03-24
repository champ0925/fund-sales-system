import os
import re
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from langchain_community.llms import Tongyi
from langchain_core.prompts import PromptTemplate
from sqlalchemy import create_engine, text
from typing import Dict, Optional

# ======================
# 环境加载
# ======================
load_dotenv()

# ======================
# 通义千问 LLM
# ======================
llm = Tongyi(
    model=os.getenv("LLM_MODEL", "qwen-turbo"),
    dashscope_api_key=os.getenv("DASHSCOPE_API_KEY"),
    temperature=0
)

# ======================
# 数据库连接（单例）
# ======================
engine = create_engine(
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
)

# ======================
# 提示词（内置，更稳定）
# ======================
SQL_TEMPLATE = """你是一个基金数据查询助手，根据用户问题生成可执行的 MySQL SQL。
数据库表：
1. products(产品表) id,product_name,product_type,latest_nav,establish_scale,product_status,create_time
2. customers(客户表) id,customer_name,phone,company,customer_status,create_time
3. customer_hold(持仓表) id,customer_id,product_id,hold_amount,buy_time
4. customer_follow(跟进表) id,customer_id,follow_way,follow_content,follow_time,next_plan

只返回SQL，不要解释，不要多余内容。
用户问题：{question}
SQL：
"""

CHART_INTENT_TEMPLATE = """你是一个基金数据助手，帮我分析用户问题是否需要生成图表。
用户问题：{question}

根据以下规则判断：
1. 如果用户要求生成"饼图"、"占比图"、"分布图"、"环形图"，返回 JSON：{{"need_chart": true, "chart_type": "pie", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
2. 如果用户要求生成"柱状图"、"条形图"、"柱形图"，返回 JSON：{{"need_chart": true, "chart_type": "bar", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
3. 如果用户要求生成"折线图"、"趋势图"、"走势图"，返回 JSON：{{"need_chart": true, "chart_type": "line", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
4. 其他情况返回 JSON：{{"need_chart": false}}

注意：
- 分组字段可以是：product_type(产品类型)、product_status(产品状态)、company(公司)
- 数值字段可以是：COUNT(*)统计数量、latest_nav(净值)、establish_scale(规模)
- 一定要使用产品表或客户表的实际字段名
- 只返回 JSON，不要其他内容

返回：
"""

ANSWER_TEMPLATE = """根据用户问题和查询数据，用自然语言回答。
问题：{question}
数据：{data}
回答：
"""

# 构建链
sql_prompt = PromptTemplate(input_variables=["question"], template=SQL_TEMPLATE)
answer_prompt = PromptTemplate(input_variables=["question", "data"], template=ANSWER_TEMPLATE)
chart_intent_prompt = PromptTemplate(input_variables=["question"], template=CHART_INTENT_TEMPLATE)
sql_chain = sql_prompt | llm
answer_chain = answer_prompt | llm
chart_intent_chain = chart_intent_prompt | llm

# ======================
# 工具函数
# ======================
def clean_sql(sql: str) -> str:
    """清洗LLM输出的SQL"""
    sql = sql.strip()
    sql = re.sub(r'^```sql', '', sql)
    sql = re.sub(r'^```', '', sql)
    sql = re.sub(r'```$', '', sql)
    return sql.strip()

def safe_execute_sql(sql: str):
    """安全执行SQL，防注入、防危险操作"""
    sql_upper = sql.strip().upper()
    if sql_upper.startswith("DELETE"):
        return None, "危险操作：不允许删除数据"
    try:
        with engine.connect() as conn:
            if sql_upper.startswith(("INSERT", "UPDATE")):
                conn.execute(text(sql))
                conn.commit()
                return True, "执行成功"
            else:
                df = pd.read_sql(sql, conn)
                return df.to_dict("records"), "查询成功"
    except Exception as e:
        return None, f"SQL错误：{str(e)}"

def parse_chart_intent(question: str) -> Optional[Dict]:
    """解析用户问题，判断是否需要生成图表"""
    try:
        result = chart_intent_chain.invoke({"question": question})
        # 清洗 JSON
        result = result.strip()
        result = re.sub(r'^```json', '', result)
        result = re.sub(r'^```', '', result)
        result = re.sub(r'```$', '', result)
        data = json.loads(result.strip())
        return data if data.get("need_chart") else None
    except Exception as e:
        print("图表意图解析失败:", e)
        return None

def generate_chart_sql(chart_config: Dict, table: str = "products") -> str:
    """根据图表配置生成 SQL"""
    group_by = chart_config.get("group_by", "product_type")
    value_field = chart_config.get("value_field", "count")
    chart_type = chart_config.get("chart_type", "pie")

    # 根据字段名映射到实际的数据库列
    field_mapping = {
        "product_type": "product_type",
        "product_status": "product_status",
        "company": "company",
    }
    db_field = field_mapping.get(group_by, group_by)

    # 数值字段处理
    if value_field == "count":
        value_sql = "COUNT(*) as value"
    elif value_field == "latest_nav":
        value_sql = "AVG(latest_nav) as value"
    elif value_field == "establish_scale":
        value_sql = "SUM(establish_scale) as value"
    else:
        value_sql = "COUNT(*) as value"

    sql = f"SELECT {db_field} as name, {value_sql} FROM {table} GROUP BY {db_field}"
    return sql

def handle_chart_request(question: str, chart_config: Dict) -> Dict:
    """处理图表请求"""
    try:
        sql = generate_chart_sql(chart_config)
        data, msg = safe_execute_sql(sql)

        if data is None:
            return {"answer": msg, "chart": None}

        if not data:
            return {"answer": "未查询到数据", "chart": None}

        return {
            "answer": f"已为您生成{chart_config.get('title', '图表')}",
            "chart": {
                "type": chart_config.get("chart_type", "pie"),
                "title": chart_config.get("title", "数据图表"),
                "data": data
            }
        }
    except Exception as e:
        return {"answer": f"图表生成失败：{str(e)}", "chart": None}

# ======================
# 添加产品（安全版）
# ======================
def handle_add_product(question: str) -> Dict:
    try:
        info = {
            "product_name": re.search(r"产品名称[是为：:]\s*([^\s，。]+)", question),
            "product_type": re.search(r"产品类型[是为：:]\s*([^\s，。]+)", question),
            "latest_nav": re.search(r"最新净值[是为：:]\s*(\d+\.?\d*)", question),
            "establish_scale": re.search(r"成立规模[^0-9]*(\d+\.?\d*)", question),
            "product_status": re.search(r"产品状态[是为：:]\s*([^\s，。]+)", question),
        }
        for k, v in info.items():
            info[k] = v.group(1) if v else None

        if not info["product_name"]: return {"answer": "请输入产品名称"}
        if not info["product_type"]: return {"answer": "请输入产品类型"}

        sql = f"""
        INSERT INTO products (product_name, product_type, latest_nav, establish_scale, product_status, create_time)
        VALUES ('{info["product_name"]}', '{info["product_type"]}', {info["latest_nav"] or 'NULL'}, {info["establish_scale"] or 'NULL'}, '{info["product_status"]}', '{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')"""
        _, msg = safe_execute_sql(sql)
        return {"answer": f"已成功新增产品：{info['product_name']}，产品类型为{info['product_type']}，最新净值为{info['latest_nav'] or '未设置'}，成立规模为{info['establish_scale'] or '未设置'}万，产品状态为{info['product_status']}。"}

    except Exception as e:
        return {"answer": f"添加失败：{str(e)}"}

# ======================
# 核心 Agent
# ======================
def run_agent(question: str) -> Dict:
    question = question.strip()
    q_low = question.lower()

    try:
        # --------------------
        # 意图0：图表生成（优先判断）
        # --------------------
        chart_config = parse_chart_intent(question)
        if chart_config:
            return handle_chart_request(question, chart_config)

        # --------------------
        # 意图1：添加产品（优先匹配，避免产品名称含关键词时被误匹配）
        # --------------------
        if "添加" in question and "产品" in question or "新增" in question and "产品" in question or "创建" in question and "产品" in question:
            return handle_add_product(question)

        # --------------------
        # 意图2：快速查询（优化速度，需要有查询/请问/帮我查等前缀）
        # --------------------

        # 检查是否有查询相关的前缀
        has_query_prefix = any(k in question for k in ["查询", "请问", "帮我查", "我想查", "查一下", "有哪些", "有什么"])

        if has_query_prefix and "股票型" in question:
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_type='股票型'")
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"股票型基金：{'、'.join(names)}" if names else "暂无数据"}

        elif has_query_prefix and "债券型" in question:
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_type='债券型'")
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"债券型基金：{'、'.join(names)}" if names else "暂无数据"}

        elif has_query_prefix and "运作中" in question:
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_status='运作中'")
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"运作中产品：{'、'.join(names)}" if names else "暂无数据"}

        elif any(k in q_low for k in ["多少", "总数", "总量"]):
            data, _ = safe_execute_sql("SELECT COUNT(*) AS total FROM products")
            total = data[0]["total"] if data else 0
            return {"answer": f"产品总数：{total} 个"}

        # --------------------
        # 意图3：动态SQL查询（LLM生成）
        # --------------------
        else:
            sql = clean_sql(sql_chain.invoke({"question": question}))
            data, msg = safe_execute_sql(sql)
            if data is None:
                return {"answer": msg}
            if not data:
                return {"answer": "未查询到数据"}
            answer = answer_chain.invoke({"question": question, "data": str(data)})
            return {"answer": answer}

    except Exception as e:
        print("系统错误：", e)
        return {"answer": "服务异常，请稍后再试"}