import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, List, Typography, Spin } from 'antd'
import { MessageOutlined, SendOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const { Paragraph } = Typography

// 检测是否为移动端
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isMobile
}

interface ChartData {
  type: 'pie' | 'bar' | 'line' | 'radar'
  title: string
  data: Array<{ name: string; value: number }>
}

interface Message {
  type: 'user' | 'ai' | 'loading' | 'thinking'
  content: string
  chart?: ChartData
}

const STORAGE_KEY = 'fund_chat_messages'
const INPUT_STORAGE_KEY = 'fund_ai_input'

const DEFAULT_WELCOME: Message = {
  type: 'ai',
  content: `你好！我是基金智能助手，我可以帮你完成以下任务：

📋 查询客户资料
  - 帮我查一下有哪些客户？
  - 查看客户张总的持仓情况

📦 管理产品
  - 帮我添加一个产品，产品名称是xxx，产品类型是股票型
  - 查询现在有哪些股票型基金？

📊 生成图表
  - 帮我生成按产品类型分组的数量饼图
  - 生成按产品状态分组的规模柱状图

💡 金融知识问答
  - 什么是基金定投？
  - 股票型和债券型有什么区别？

💬 试试这样说："帮我生成按产品类型分组的数量饼图"`
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

function ChartRenderer({ chart, isMobile }: { chart: ChartData; isMobile?: boolean }) {
  const data = chart.data.map(item => ({
    name: item.name || '未知',
    value: Number(item.value) || 0
  }))

  const chartWidth = isMobile ? 280 : 400
  const chartHeight = isMobile ? 180 : 250
  const labelFontSize = isMobile ? 10 : 12

  if (chart.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={!isMobile ? ({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%` : undefined}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend formatter={(value) => isMobile ? value.substring(0, 3) : value} />
          <Tooltip formatter={(value) => [`${value}`, '数值']} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data}>
          <XAxis dataKey="name" fontSize={labelFontSize} />
          <YAxis fontSize={labelFontSize} />
          <Tooltip formatter={(value) => [`${value}`, '数值']} />
          <Bar dataKey="value" fill="#0088FE" name="数值" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={data}>
          <XAxis dataKey="name" fontSize={labelFontSize} />
          <YAxis fontSize={labelFontSize} />
          <Tooltip formatter={(value) => [`${value}`, '数值']} />
          <Line type="monotone" dataKey="value" stroke="#0088FE" name="数值" />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'radar') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" fontSize={labelFontSize} />
          <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
          <Radar name="数值" dataKey="value" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
          <Tooltip formatter={(value) => [`${value}`, '数值']} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  return null
}

export default function AIAgent() {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [DEFAULT_WELCOME]
      }
    }
    return [DEFAULT_WELCOME]
  })
  const [input, setInput] = useState(() => {
    return localStorage.getItem(INPUT_STORAGE_KEY) || ''
  })
  const [loading, setLoading] = useState(false)
  const listRef = useRef<any>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 持久化消息到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  // 持久化输入框内容到 localStorage
  useEffect(() => {
    localStorage.setItem(INPUT_STORAGE_KEY, input)
  }, [input])

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const sendQuestion = async () => {
    if (!input.trim() || loading) return
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const userMsg: Message = { type: 'user', content: input }

    // 添加用户消息和loading状态
    setMessages(prev => [...prev, userMsg, { type: 'thinking', content: '' }])
    const inputValue = input
    setInput('')
    setLoading(true)

    // 立即滚动到底部
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }, 0)

    const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8001'

    try {
      const response = await fetch(`${AI_API_URL}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: inputValue }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'thinking') {
                // 更新 thinking 状态
                setMessages(prev => {
                  const filtered = prev.filter(m => m.type !== 'thinking')
                  return [...filtered, { type: 'thinking', content: data.content || '正在思考...' }]
                })
              } else if (data.type === 'content') {
                // 更新 AI 回答内容（追加模式）
                setMessages(prev => {
                  const filtered = prev.filter(m => m.type !== 'thinking')
                  const lastAiMsg = filtered[filtered.length - 1]
                  if (lastAiMsg && lastAiMsg.type === 'ai') {
                    // 追加内容
                    return [
                      ...filtered.slice(0, -1),
                      { ...lastAiMsg, content: data.content }
                    ]
                  } else {
                    // 新建 AI 消息
                    return [...filtered, { type: 'ai', content: data.content }]
                  }
                })
              } else if (data.type === 'chart') {
                // 添加图表（图表不走流式，直接创建消息）
                setMessages(prev => {
                  const filtered = prev.filter(m => m.type !== 'thinking')
                  const newMsg = {
                    type: 'ai' as const,
                    content: data.answer || '已为您生成图表',
                    chart: data.chart
                  }
                  return [...filtered, newMsg]
                })
              } else if (data.type === 'done') {
                // 完成
                setMessages(prev => prev.filter(m => m.type !== 'thinking'))
              }
              
              // 滚动到底部
              setTimeout(() => {
                if (listRef.current) {
                  listRef.current.scrollTop = listRef.current.scrollHeight
                }
              }, 0)
              
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 请求被取消，不显示错误
        return
      }
      // 移除thinking状态，添加错误消息
      setMessages(prev => {
        const filtered = prev.filter(m => m.type !== 'thinking')
        return [...filtered, { type: 'ai', content: '服务异常，请稍后再试' }]
      })
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  // 清空聊天记录
  const clearChat = async () => {
    // 取消正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    localStorage.removeItem(STORAGE_KEY)
    setMessages([DEFAULT_WELCOME])
    setLoading(false)
  }

  return (
    <Card
      title={<><MessageOutlined /> AI 智能基金助手</>}
      extra={
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={clearChat}
          danger
        >
          清空聊天
        </Button>
      }
      style={{ height: '100%' }}
    >
      <div style={{
        height: isMobile ? 'calc(100vh - 200px)' : '500px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <List
          ref={listRef}
          itemLayout="vertical"
          dataSource={messages}
          style={{ overflowY: 'auto', marginBottom: 16, maxHeight: isMobile ? 'calc(100% - 60px)' : 420 }}
          renderItem={(item) => (
            <List.Item style={{ textAlign: item.type === 'user' ? 'right' : 'left' }}>
              {item.type === 'loading' || item.type === 'thinking' ? (
                <Card
                  size="small"
                  style={{
                    maxWidth: isMobile ? '85%' : '70%',
                    display: 'inline-block',
                    background: '#f5f5f5'
                  }}
                >
                  <Spin indicator={<LoadingOutlined style={{ fontSize: isMobile ? 14 : 18 }} spin />} />
                  <span style={{ marginLeft: 8, fontSize: isMobile ? 12 : 14 }}>{item.content || '正在思考...'}</span>
                </Card>
              ) : (
                <Card
                  size="small"
                  style={{
                    maxWidth: isMobile ? '85%' : '70%',
                    display: 'inline-block',
                    background: item.type === 'user' ? '#e6f7ff' : '#f5f5f5'
                  }}
                >
                  <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: isMobile ? 12 : 14 }}>{item.content}</Paragraph>
                  {item.chart && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ marginBottom: 8, fontSize: isMobile ? 12 : 14 }}>{item.chart.title}</h4>
                      <ChartRenderer chart={item.chart} isMobile={isMobile} />
                    </div>
                  )}
                </Card>
              )}
            </List.Item>
          )}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            onPressEnter={sendQuestion}
            disabled={loading}
            style={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={sendQuestion} loading={loading}>
            发送
          </Button>
        </div>
      </div>
    </Card>
  )
}