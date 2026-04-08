"""测试 RAG 知识库加载"""

import os
import sys

# 确保能导入 src 模块（添加上级目录 fund-agent 到路径）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

print("=" * 50)
print("RAG 知识库测试")
print("=" * 50)

# 1. 检查知识库路径
from src.rag.document_loader import get_knowledge_path, load_knowledge_directory
knowledge_path = get_knowledge_path()
print(f"\n1. 知识库路径: {knowledge_path}")
print(f"   路径存在: {os.path.exists(knowledge_path)}")

# 2. 加载知识库文件
print("\n2. 加载知识库文件...")
documents = load_knowledge_directory(knowledge_path)
print(f"   加载文档数: {len(documents)}")
for doc in documents:
    print(f"   - {doc.metadata.get('source')}: {len(doc.page_content)} 字符")

# 3. 检查文本分块
if documents:
    from src.rag.text_splitter import get_default_splitter
    splitter = get_default_splitter()
    split_docs = splitter.split_documents(documents)
    print(f"\n3. 文本分块: {len(split_docs)} 个")

# 4. 检查向量存储
from src.rag.vector_store import get_vector_store, VectorStoreManager
print("\n4. 创建向量存储...")
embedding = VectorStoreManager.get_default_embedding()
print(f"   嵌入模型: {embedding.model}")

vector_store = get_vector_store(knowledge_path=knowledge_path, force_rebuild=True)
if vector_store:
    print(f"   向量存储: OK")

    # 5. 测试检索
    print("\n5. 测试检索...")
    test_question = "股票型基金的赎回费率是多少？"
    docs = vector_store.similarity_search(test_question, k=2)
    print(f"   检索问题: {test_question}")
    print(f"   检索结果数: {len(docs)}")
    for i, doc in enumerate(docs, 1):
        print(f"   结果 {i}: {doc.page_content[:100]}...")
else:
    print("   向量存储: 失败")

print("\n" + "=" * 50)
print("测试完成")
print("=" * 50)