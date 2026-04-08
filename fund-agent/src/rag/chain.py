"""RAG Chain - 检索增强生成链（简化版）"""

import os
from typing import Dict, List, Any, Iterator
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough


# RAG 提示词模板
RAG_QA_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""你是一个专业的基金销售知识库问答助手。

请根据以下检索到的知识库内容回答用户的问题。

## 知识库内容
{context}

## 用户问题
{question}

## 回答要求
1. 只根据提供的知识库内容回答，不要编造信息
2. 如果知识库中没有相关内容，请明确告知用户
3. 回答要专业、准确、简洁
4. 如果需要，可以结合多个检索结果综合回答

回答：
"""
)


def get_rag_chain(
    knowledge_path: str = None,
    persist_directory: str = None,
    k: int = None,
    force_rebuild: bool = False
):
    """获取 RAG Chain

    Args:
        knowledge_path: 知识库路径
        persist_directory: 向量存储持久化目录
        k: 检索数量
        force_rebuild: 是否强制重建

    Returns:
        RAG Chain (Runnable)
    """
    # 设置默认路径
    if knowledge_path is None:
        knowledge_path = os.getenv("RAG_KNOWLEDGE_PATH")
        if knowledge_path is None:
            from src.rag.document_loader import get_knowledge_path
            knowledge_path = get_knowledge_path()

    if persist_directory is None:
        persist_directory = os.getenv("RAG_PERSIST_DIR")
        if persist_directory is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            persist_directory = os.path.join(os.path.dirname(current_dir), "data", "vectorstore")
    
    if k is None:
        k = int(os.getenv("RAG_RETRIEVER_K", "4"))

    # 获取向量存储
    from src.rag.vector_store import get_vector_store
    vector_store = get_vector_store(
        knowledge_path=knowledge_path,
        persist_directory=persist_directory,
        force_rebuild=force_rebuild
    )

    if vector_store is None:
        return None

    # 创建检索器
    retriever = vector_store.as_retriever(search_kwargs={"k": k})

    # 获取 LLM
    from src.chain import llm

    # 构建 RAG Chain
    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | RAG_QA_PROMPT
        | llm
    )

    return rag_chain


def rag_query(question: str, **kwargs) -> Dict[str, Any]:
    """RAG 查询（同步）

    Args:
        question: 问题
        **kwargs: 其他参数

    Returns:
        包含 answer 的字典
    """
    chain = get_rag_chain(**kwargs)

    if chain is None:
        return {"answer": "知识库未配置或加载失败"}

    try:
        answer = chain.invoke(question)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"RAG 查询失败: {str(e)}"}


def rag_stream(
    question: str,
    knowledge_path: str = None,
    persist_directory: str = None,
    k: int = None
) -> Iterator[str]:
    """RAG 流式回答

    Args:
        question: 问题
        knowledge_path: 知识库路径
        persist_directory: 向量存储持久化目录
        k: 检索数量

    Yields:
        流式输出的文本片段
    """
    # 设置默认路径
    if knowledge_path is None:
        knowledge_path = os.getenv("RAG_KNOWLEDGE_PATH")
        if knowledge_path is None:
            from src.rag.document_loader import get_knowledge_path
            knowledge_path = get_knowledge_path()

    if persist_directory is None:
        persist_directory = os.getenv("RAG_PERSIST_DIR")
        if persist_directory is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            persist_directory = os.path.join(os.path.dirname(current_dir), "data", "vectorstore")
    
    if k is None:
        k = int(os.getenv("RAG_RETRIEVER_K", "4"))

    from src.rag.retriever import retrieve_documents, format_retrieved_context
    from src.chain import llm

    # 1. 检索相关文档
    docs = retrieve_documents(
        question=question,
        knowledge_path=knowledge_path,
        persist_directory=persist_directory,
        k=k,
    )

    if not docs:
        yield "抱歉，未在知识库中找到相关信息。"
        return

    # 2. 构建上下文
    context = format_retrieved_context(docs)

    # 3. 先获取完整回答，再按句子流式输出
    prompt = f"""基于以下知识库内容回答问题：

{context}

问题：{question}

回答："""

    # 收集完整回答
    full_answer = ""
    for chunk in llm.stream(prompt):
        if chunk:
            full_answer += str(chunk)

    # 从环境变量获取流式输出配置
    chunk_size = int(os.getenv("RAG_STREAM_CHUNK_SIZE", "15"))
    stream_delay = float(os.getenv("RAG_STREAM_DELAY", "0.02"))
    
    # 按句子或短语流式输出
    buffer = ""
    for char in full_answer:
        buffer += char
        if len(buffer) >= chunk_size or char in "。！？\n":
            yield buffer
            buffer = ""
            # 添加小延迟让前端有时间处理
            import time
            time.sleep(stream_delay)
    # 输出剩余内容
    if buffer:
        yield buffer


def is_rag_question(question: str) -> bool:
    """判断是否为知识库相关问题

    Args:
        question: 用户问题

    Returns:
        是否应该使用 RAG
    """
    # 数据库表相关关键词 - 如果问题涉及这些，不走RAG，走SQL查询
    db_keywords = ["产品", "客户", "持仓", "跟进", "销售额", "业绩", "公司", "姓名", "电话"]

    # RAG 相关关键词 - 金融知识相关
    rag_keywords = [
        "产品说明", "基金合同", "招募说明书", "费率", "费用",
        "投资策略", "风险等级", "业绩比较基准", "基金经理",
        "产品特点", "产品优势", "赎回", "认购", "申购",
        "封闭期", "开放期", "分红方式", "估值方法",
        "合规", "法律", "条款", "规定", "办法",
        "知识库", "文档", "说明书", "手册", "规则",
        "客户风险", "适当性", "双录", "禁止行为",
        # 基金类型相关
        "股票型", "债券型", "混合型", "货币型", "指数型", "股票型基金", "债券型基金", "混合型基金", "货币型基金", "指数型基金", "QDII基金",
        "公募基金", "私募基金", "开放式基金", "封闭式基金", "定期开放基金",
        # 基金类型区别
        "有什么区别", "区别", "有什么不同", "有什么差异",
        # 基金定投相关
        "什么是基金定投", "定期定额", "定投", "智能定投", "平均成本", "复利效应", "止盈", "定投优势",
        # 投资者类型
        "保守型", "稳健型", "平衡型", "激进型", "风险承受能力", "资产配置",
        # 股票相关
        "股票", "A股", "B股", "主板", "创业板", "科创板", "市盈率", "市净率",
        "股息率", "涨停", "跌停", "T+1", "股市", "股东", "股息", "分红",
        # 债券相关
        "债券", "政府债券", "企业债券", "金融债券", "国债", "久期",
        "信用评级", "利率风险", "信用风险", "到期收益率", "固定利率", "浮动利率",
        # 货币市场
        "货币市场", "货币基金", "国库券", "同业拆借", "Shibor", "Libor", "回购协议",
        # 金融通用关键词
        "基金", "理财", "净值", "收益率", "ETF", "FOF", "LOF",
        "私募", "公募", "量化", "交易", "投资", "收益", "风险",
    ]

    # 检查是否涉及数据库查询（产品、客户、持仓等）- 这些不走RAG
    is_db_query = any(kw in question for kw in db_keywords)

    # 检查是否包含 RAG 关键词
    has_rag_keyword = any(kw in question for kw in rag_keywords)

    # 如果涉及数据库查询，不走RAG
    if is_db_query:
        return False

    # 只有金融知识相关问题才走RAG
    return has_rag_keyword


# 导出
rag_chain = None  # 延迟初始化