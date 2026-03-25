import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, List, Typography, Spin } from 'antd'
import { MessageOutlined, SendOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import axios from 'axios'

const { Paragraph } = Typography

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
  content: '你好！我是基金智能助手，我可以帮你完成多种任务：\n\n📊 **数据查询** - 帮我查一下股票型基金有哪些？运作中的产品有多少？\n\n📈 **生成图表** - 帮我生成按产品类型分组的规模占比饼图、柱状图、雷达图\n\n➕ **添加产品** - 帮我添加一个产品，产品名称是xxx，产品类型是股票型\n\n💡 试试这样说："帮我生成按产品类型分组的数量饼图"'
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

function ChartRenderer({ chart }: { chart: ChartData }) {
  const data = chart.data.map(item => ({
    name: item.name || '未知',
    value: Number(item.value) || 0
  }))

  const chartWidth = 400
  const chartHeight = 250

  if (chart.type === 'pie') {
    return (
      <PieChart width={chartWidth} height={chartHeight}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
        <Tooltip formatter={(value) => [`${value}`, '数值']} />
      </PieChart>
    )
  }

  if (chart.type === 'bar') {
    return (
      <BarChart width={chartWidth} height={chartHeight} data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => [`${value}`, '数值']} />
        <Bar dataKey="value" fill="#0088FE" name="数值" />
      </BarChart>
    )
  }

  if (chart.type === 'line') {
    return (
      <LineChart width={chartWidth} height={chartHeight} data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => [`${value}`, '数值']} />
        <Line type="monotone" dataKey="value" stroke="#0088FE" name="数值" />
      </LineChart>
    )
  }

  if (chart.type === 'radar') {
    return (
      <RadarChart cx="50%" cy="50%" outerRadius="80%" width={chartWidth} height={chartHeight} data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
        <Radar name="数值" dataKey="value" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
        <Tooltip formatter={(value) => [`${value}`, '数值']} />
      </RadarChart>
    )
  }

  return null
}

export default function AIAgent() {
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

    try {
      const response = await fetch('http://localhost:8001/ai/stream', {
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
                // 添加图表
                setMessages(prev => {
                  const filtered = prev.filter(m => m.type !== 'thinking')
                  const lastAiMsg = filtered[filtered.length - 1]
                  if (lastAiMsg && lastAiMsg.type === 'ai') {
                    return [
                      ...filtered.slice(0, -1),
                      { ...lastAiMsg, chart: data.chart }
                    ]
                  }
                  return filtered
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
        height: '500px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <List
          ref={listRef}
          itemLayout="vertical"
          dataSource={messages}
          style={{ overflowY: 'auto', marginBottom: 16, maxHeight: 420 }}
          renderItem={(item) => (
            <List.Item style={{ textAlign: item.type === 'user' ? 'right' : 'left' }}>
              {item.type === 'loading' || item.type === 'thinking' ? (
                <Card
                  size="small"
                  style={{
                    maxWidth: '70%',
                    display: 'inline-block',
                    background: '#f5f5f5'
                  }}
                >
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />} />
                  <span style={{ marginLeft: 8 }}>{item.content || '正在思考...'}</span>
                </Card>
              ) : (
                <Card
                  size="small"
                  style={{
                    maxWidth: '70%',
                    display: 'inline-block',
                    background: item.type === 'user' ? '#e6f7ff' : '#f5f5f5'
                  }}
                >
                  <Paragraph>{item.content}</Paragraph>
                  {item.chart && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ marginBottom: 8 }}>{item.chart.title}</h4>
                      <ChartRenderer chart={item.chart} />
                    </div>
                  )}
                </Card>
              )}
            </List.Item>
          )}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            onPressEnter={sendQuestion}
            disabled={loading}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={sendQuestion} loading={loading}>
            发送
          </Button>
        </div>
      </div>
    </Card>
  )
}