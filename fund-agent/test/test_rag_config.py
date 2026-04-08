"""测试RAG配置加载"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

print("=" * 60)
print("RAG配置测试")
print("=" * 60)

# 打印所有RAG相关配置
rag_configs = {
    "RAG_KNOWLEDGE_PATH": os.getenv("RAG_KNOWLEDGE_PATH"),
    "RAG_PERSIST_DIR": os.getenv("RAG_PERSIST_DIR"),
    "RAG_RETRIEVER_K": os.getenv("RAG_RETRIEVER_K"),
    "RAG_CHUNK_SIZE": os.getenv("RAG_CHUNK_SIZE"),
    "RAG_CHUNK_OVERLAP": os.getenv("RAG_CHUNK_OVERLAP"),
    "RAG_VECTOR_STORE": os.getenv("RAG_VECTOR_STORE"),
    "RAG_STREAM_CHUNK_SIZE": os.getenv("RAG_STREAM_CHUNK_SIZE"),
    "RAG_STREAM_DELAY": os.getenv("RAG_STREAM_DELAY"),
    "RAG_SEPARATORS": os.getenv("RAG_SEPARATORS"),
    "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL"),
    "LLM_MODEL": os.getenv("LLM_MODEL"),
}

print("\n📋 环境变量配置:")
for key, value in rag_configs.items():
    if value:
        print(f"  {key}: {value}")
    else:
        print(f"  {key}: 未设置 (使用默认值)")

print("\n🔧 测试模块配置加载:")

# 测试文本分块器配置
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.rag.text_splitter import get_default_splitter

splitter = get_default_splitter()
print(f"  文本分块器: chunk_size={splitter._chunk_size}, chunk_overlap={splitter._chunk_overlap}")
print(f"  分隔符数量: {len(splitter._separators)} 个")
# 显示前几个分隔符（避免输出过多）
separators_display = [repr(sep) for sep in splitter._separators[:5]]
if len(splitter._separators) > 5:
    separators_display.append("...")
print(f"  分隔符示例: {' | '.join(separators_display)}")

# 测试向量存储配置
from src.rag.vector_store import VectorStoreManager

embedding = VectorStoreManager.get_default_embedding()
print(f"  嵌入模型: {embedding.model}")

# 测试检索器配置
from src.rag.retriever import get_retriever
import tempfile

# 创建一个临时向量存储用于测试
try:
    from src.rag.vector_store import get_vector_store
    temp_dir = tempfile.mkdtemp()
    
    # 使用默认知识库路径
    from src.rag.document_loader import get_knowledge_path
    knowledge_path = get_knowledge_path()
    
    if os.path.exists(knowledge_path):
        vector_store = get_vector_store(
            knowledge_path=knowledge_path,
            persist_directory=temp_dir,
            force_rebuild=True
        )
        
        if vector_store:
            retriever = get_retriever(vector_store=vector_store)
            print(f"  检索器: k={retriever.search_kwargs.get('k', 'unknown')}")
            print(f"  向量存储类型: {os.getenv('RAG_VECTOR_STORE', 'chroma')}")
        else:
            print("  向量存储: 创建失败")
    else:
        print(f"  知识库路径不存在: {knowledge_path}")
        
except Exception as e:
    print(f"  测试出错: {e}")

print("\n📁 路径检查:")
knowledge_path = get_knowledge_path()
print(f"  知识库路径: {knowledge_path}")
print(f"  路径存在: {os.path.exists(knowledge_path)}")

persist_dir = os.getenv("RAG_PERSIST_DIR", "./data/vectorstore")
print(f"  向量存储路径: {persist_dir}")
print(f"  父目录存在: {os.path.exists(os.path.dirname(persist_dir) or '.')}")

print("\n" + "=" * 60)
print("配置测试完成")
print("=" * 60)