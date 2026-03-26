import os
import re
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from langchain_community.llms import Tongyi
from langchain_core.prompts import PromptTemplate
from sqlalchemy import create_engine, text
from typing import Dict, Optional, Iterator

# 导入外部prompt（优化后的）
from src.prompt import SQL_PROMPT, ANSWER_PROMPT

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
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}?charset=utf8mb4",
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={
        "charset": "utf8mb4"
    }
)

# ======================
# 提示词（从外部导入）
# ======================
CHART_INTENT_TEMPLATE = """你是一个基金数据助手，帮我分析用户问题是否需要生成图表。
用户问题：{question}

根据以下规则判断：
1. 如果用户要求生成"饼图"、"占比图"、"分布图"、"环形图"，返回 JSON：{{"need_chart": true, "chart_type": "pie", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
2. 如果用户要求生成"柱状图"、"条形图"、"柱形图"，返回 JSON：{{"need_chart": true, "chart_type": "bar", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
3. 如果用户要求生成"折线图"、"趋势图"、"走势图"，返回 JSON：{{"need_chart": true, "chart_type": "line", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
4. 如果用户要求生成"雷达图"，返回 JSON：{{"need_chart": true, "chart_type": "radar", "group_by": "分组字段", "value_field": "数值字段", "title": "图表标题"}}
5. 其他情况返回 JSON：{{"need_chart": false}}

注意：
- 分组字段可以是：product_type(产品类型)、product_status(产品状态)、company(公司)
- 数值字段可以是：COUNT(*)统计数量、latest_nav(净值)、establish_scale(规模)
- 一定要使用产品表或客户表的实际字段名
- 只返回 JSON，不要其他内容

返回：
"""

# 构建链（使用外部导入的优化prompt）
sql_prompt = SQL_PROMPT
answer_prompt = ANSWER_PROMPT
chart_intent_prompt = PromptTemplate(input_variables=["question"], template=CHART_INTENT_TEMPLATE)
sql_chain = sql_prompt | llm
answer_chain = answer_prompt | llm
chart_intent_chain = chart_intent_prompt | llm

# ======================
# 辅助函数
# ======================
def stream_llm(prompt: str) -> Iterator[str]:
    """流式调用LLM，返回生成器"""
    for chunk in llm.stream(prompt):
        if chunk:
            yield chunk

def stream_generate(prompt: str) -> str:
    """流式调用LLM并收集完整输出"""
    chunks = []
    for chunk in llm.stream(prompt):
        if chunk:
            chunks.append(str(chunk))
    return "".join(chunks)

# ======================
# 工具函数
# ======================
def clean_sql(sql: str) -> str:
    """清洗LLM输出的SQL"""
    sql = sql.strip()
    sql = re.sub(r'^```sql', '', sql)
    sql = re.sub(r'^```', '', sql)
    sql = re.sub(r'```$', '', sql)
    # 清洗 SQL: 或 SQL： 前缀
    sql = re.sub(r'^(SQL|sql)[:：]\s*', '', sql)
    return sql.strip()

def safe_execute_sql(sql: str, question: str = ""):
    """安全执行SQL，防注入、防危险操作
    
    Args:
        sql: 要执行的SQL语句
        question: 用户原始问题，用于判断意图
    """
    # 判断用户意图：只有查询/查看/添加/统计相关的问题才执行SQL
    if question:
        # 数据库表相关关键词（根据prompt.py中的表结构）
        query_keywords = [
            # 通用查询
            "查询", "请问", "帮我查", "我想查", "查一下", "有哪些", "有什么",
            "查看", "看", "统计", "多少", "总数", "总量", "余额",
            # 产品相关
            "产品", "基金", "净值", "产品类型", "产品状态", "运作中", "募集", "清盘",
            "债券型", "股票型", "混合型", "货币型",
            # 客户相关
            "客户", "客户公司", "客户状态", "客户姓名",
            # 持仓相关
            "持仓", "持有", "购买", "持有金额", "购买时间",
            # 跟进相关
            "跟进", "跟进记录", "跟进时间", "跟进方式", "下次计划",
            # 操作相关
            "添加", "新增", "创建", "修改", "更新",
            # 销售业绩
            "销售额", "业绩", "销售"
        ]
        
        # 检查问题是否包含查询相关的关键词
        is_query_related = any(kw in question for kw in query_keywords)
        
        if not is_query_related:
            # 非查询类问题，返回友好提示
            return None, "我是一个基金数据查询助手，请询问关于产品、客户、持仓、跟进记录等数据库相关的问题，例如：帮我查询有哪些产品、客户持仓情况、跟进记录等。"
    
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
        import traceback
        print(f"[SQL ERROR] {str(e)}")
        print(f"[SQL TRACE] {traceback.format_exc()}")
        return None, f"SQL错误：{str(e)}"

def parse_chart_intent(question: str) -> Optional[Dict]:
    """解析用户问题，判断是否需要生成图表
    
    只有用户明确提及图表类型（饼图/柱状图/K线图/雷达图等），
    且问题与产品表字段相关时才生成图表
    
    products表字段：product_name, product_type, latest_nav, product_status, create_time
    """
    # 图表类型关键词
    chart_type_map = {
        "pie": ["饼图", "占比图", "分布图", "环形图"],
        "bar": ["柱状图", "柱形图", "条形图"],
        "line": ["折线图", "趋势图", "走势图"],
        "radar": ["雷达图"],
    }
    
    # 产品表字段关键词（products表：id, product_name, product_type, latest_nav, establish_scale, product_status, create_time）
    field_map = {
        "product_type": ["产品类型", "类型"],
        "product_status": ["产品状态", "状态"],
        "latest_nav": ["净值"],
        "product_name": ["产品名称", "产品名"],
        "establish_scale": ["成立规模", "规模", "发行金额"],
        "create_time": ["创建时间", "成立时间"],
    }
    
    # 检查是否明确提及图表类型
    chart_type = None
    for ct, keywords in chart_type_map.items():
        if any(kw in question for kw in keywords):
            chart_type = ct
            break
    
    if not chart_type:
        return None
    
    # 检查是否与产品表字段相关，并确定分组字段
    group_by = None
    for field, keywords in field_map.items():
        if any(kw in question for kw in keywords):
            group_by = field
            break
    
    # 默认按产品类型分组
    if not group_by:
        group_by = "product_type"
    
    # 数值字段：计数用COUNT(*)，净值用AVG
    value_field = "count" if group_by != "latest_nav" else "latest_nav"
    
    # 生成标题
    field_name = {"product_type": "产品类型", "product_status": "产品状态",
                  "latest_nav": "净值", "product_name": "产品名称",
                  "establish_scale": "成立规模", "create_time": "创建时间"}.get(group_by, group_by)
    chart_name = {"pie": "饼图", "bar": "柱状图", "line": "折线图", "radar": "雷达图"}.get(chart_type, "图表")
    
    return {
        "need_chart": True,
        "chart_type": chart_type,
        "group_by": group_by,
        "value_field": value_field,
        "title": f"{field_name}{chart_name}"
    }

def generate_chart_sql(chart_config: Dict, table: str = "products") -> str:
    """根据图表配置生成 SQL，限定在 products 表的字段范围内
    
    products表字段：id, product_name, product_type, latest_nav, establish_scale, product_status, create_time
    """
    group_by = chart_config.get("group_by", "product_type")
    value_field = chart_config.get("value_field", "count")
    chart_type = chart_config.get("chart_type", "pie")

    # 产品表字段映射（只支持 products 表的字段）
    field_mapping = {
        "product_type": "product_type",
        "product_status": "product_status",
        "product_name": "product_name",
        "latest_nav": "latest_nav",
        "establish_scale": "establish_scale",
        "create_time": "create_time",
    }
    db_field = field_mapping.get(group_by, group_by)

    # 数值字段处理（只支持 products 表的字段）
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
        data, msg = safe_execute_sql(sql, question)

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
        _, msg = safe_execute_sql(sql, question)
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
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_type='股票型'", question)
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"股票型基金：{'、'.join(names)}" if names else "暂无数据"}

        elif has_query_prefix and "债券型" in question:
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_type='债券型'", question)
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"债券型基金：{'、'.join(names)}" if names else "暂无数据"}

        elif has_query_prefix and "运作中" in question:
            data, _ = safe_execute_sql("SELECT product_name FROM products WHERE product_status='运作中'", question)
            names = [i["product_name"] for i in data] if data else []
            return {"answer": f"运作中产品：{'、'.join(names)}" if names else "暂无数据"}

        elif any(k in q_low for k in ["多少", "总数", "总量"]):
            data, _ = safe_execute_sql("SELECT COUNT(*) AS total FROM products", question)
            total = data[0]["total"] if data else 0
            return {"answer": f"产品总数：{total} 个"}

        # --------------------
        # 意图3：动态SQL查询（LLM生成）
        # --------------------
        else:
            # 流式生成SQL
            sql_chunks = []
            for chunk in sql_chain.stream({"question": question}):
                if chunk:
                    chunk_str = str(chunk)
                    sql_chunks.append(chunk_str)
            sql = clean_sql("".join(sql_chunks))
            
            # 空SQL校验
            if not sql or sql.strip() == "":
                # 检测是否涉及金融相关问题
                finance_keywords = ["基金", "股票", "债券", "货币", "理财", "净值", "收益率", "ETF", "FOF", "LOF", "私募", "公募", "量化", "交易"]
                is_finance_related = any(kw in question for kw in finance_keywords)
                
                if is_finance_related:
                    # 流式调用LLM进行金融知识科普
                    finance_prompt = f"""你是一个专业的金融理财顾问，请用通俗易懂的语言回答用户的问题。
用户问题：{question}

请给出专业但易懂的解答："""
                    answer = stream_generate(finance_prompt)
                    return {"answer": answer, "stream": True}
                else:
                    return {"answer": "抱歉，我无法理解您的问题。我是一个基金数据查询助手，请询问关于产品、客户、持仓等数据库相关的问题。"}
            data, msg = safe_execute_sql(sql, question)
            if data is None:
                return {"answer": msg}
            if not data:
                return {"answer": "未查询到数据"}
            # 流式生成回答
            answer_chunks = []
            for chunk in answer_chain.stream({"question": question, "data": str(data)}):
                if chunk:
                    chunk_str = str(chunk)
                    answer_chunks.append(chunk_str)
            answer = "".join(answer_chunks)
            return {"answer": answer, "stream": True}

    except Exception as e:
        print("系统错误：", e)
        return {"answer": "服务异常，请稍后再试"}