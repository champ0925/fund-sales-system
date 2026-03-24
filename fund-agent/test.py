import os
from dotenv import load_dotenv
from langchain_community.llms import Tongyi

# 加载环境变量
load_dotenv()

# 测试函数
def test_qwen_api():
    try:
        # 初始化通义千问
        llm = Tongyi(
            model="qwen-turbo",
            dashscope_api_key=os.getenv("DASHSCOPE_API_KEY"),
            temperature=0.5
        )

        # 测试一句话
        test_prompt = "你好，简单介绍一下自己"
        print("🤖 正在调用通义千问...")
        print("📝 问题：", test_prompt)

        # 调用
        response = llm.invoke(test_prompt)

        # 输出结果
        print("\n✅ 调用成功！")
        print("📩 通义千问返回：")
        print(response)
        return True

    except Exception as e:
        print("\n❌ 调用失败！")
        print("错误信息：", str(e))
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("🧪 通义千问 API 连接测试")
    print("=" * 50)
    test_qwen_api()