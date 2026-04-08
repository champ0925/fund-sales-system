"""测试分隔符配置效果"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_separators():
    """测试不同分隔符配置的效果"""
    print("=" * 60)
    print("分隔符配置测试")
    print("=" * 60)
    
    # 测试文本
    test_text = """这是一个测试文本。

第一段内容，包含中文句号。

第二段内容；包含中文分号。

第三段内容,包含中文逗号。

第四段内容.包含英文句号。

第五段内容，最后一段。"""
    
    print("原始测试文本:")
    print(test_text)
    print("\n" + "-" * 40 + "\n")
    
    # 测试当前配置
    from src.rag.text_splitter import get_default_splitter
    current_splitter = get_default_splitter()
    
    print(f"当前配置的分隔符 ({len(current_splitter._separators)} 个):")
    for i, sep in enumerate(current_splitter._separators):
        if sep == "":
            print(f"  {i+1}. '' (空字符串 - 字符级分割)")
        else:
            print(f"  {i+1}. {repr(sep)}")
    print()
    
    # 使用langchain的分割功能测试
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    
    # 当前配置分割
    current_docs = current_splitter.split_text(test_text)
    print(f"当前配置分割结果: {len(current_docs)} 块")
    for i, doc in enumerate(current_docs):
        print(f"  块 {i+1}: {repr(doc[:50])}{'...' if len(doc) > 50 else ''}")
    print()
    
    # 测试自定义分隔符
    print("测试自定义分隔符配置:")
    os.environ["RAG_SEPARATORS"] = "\n\n|\n|。"
    
    custom_splitter = get_default_splitter()
    custom_docs = custom_splitter.split_text(test_text)
    print(f"自定义分隔符分割结果: {len(custom_docs)} 块")
    for i, doc in enumerate(custom_docs):
        print(f"  块 {i+1}: {repr(doc[:50])}{'...' if len(doc) > 50 else ''}")
    print()
    
    # 恢复原始配置
    os.environ["RAG_SEPARATORS"] = "\n\n|\n|。|.|；|;|，|,| |"
    
    print("=" * 60)
    print("分隔符配置测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_separators()