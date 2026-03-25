import { useState, useEffect } from 'react'
import { Card, Row, Col } from 'antd'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import axios from 'axios'
import apiConfig from '../../utils/api'

interface ProductTypeStat {
  name: string
  count: number
}

export default function Dashboard() {
  const [typeData, setTypeData] = useState<ProductTypeStat[]>([])

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
      <Row gutter={24}>
        <Col span={12}>
          <Card title="产品类型分布" size="small">
            <PieChart width={320} height={260}>
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
          </Card>
        </Col>

        <Col span={12}>
          <Card title="产品类型数量统计" size="small">
            <BarChart width={320} height={260} data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} 个`, '产品数量']} />
              <Bar dataKey="value" fill="#0088FE" name="产品数量" />
            </BarChart>
          </Card>
        </Col>
      </Row>
    </Card>
  )
}