import { useState, useEffect } from 'react'
import { Card, Row, Col } from 'antd'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import axios from 'axios'
import apiConfig from '../../utils/api'

interface ProductTypeStat {
  name: string
  count: number
}

// 检测是否为移动端
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isMobile
}

export default function Dashboard() {
  const [typeData, setTypeData] = useState<ProductTypeStat[]>([])
  const isMobile = useIsMobile()

  const getStat = async () => {
    try {
      const res = await axios.get(apiConfig.endpoints.dashboardProductType)
      // console.log('Dashboard统计数据响应:', res.data)
      setTypeData(res.data) 
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  useEffect(() => {
    getStat()
  }, [])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  const chartData = typeData.map(item => ({
    name: item.name,
    value: item.count
  }))

  return (
    <Card title="数据概览">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={24} md={12}>
          <Card title="产品类型分布" size="small">
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={() => ''}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(value) => [`${value} 个`, '产品数量']} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} sm={24} md={12}>
          <Card title="产品类型数量统计" size="small">
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={isMobile ? 10 : 12} />
                <YAxis fontSize={isMobile ? 10 : 12} />
                <Tooltip formatter={(value) => [`${value} 个`, '产品数量']} />
                <Bar dataKey="value" fill="#0088FE" name="产品数量" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </Card>
  )
}