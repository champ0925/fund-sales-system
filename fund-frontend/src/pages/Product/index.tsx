import { useState, useEffect } from 'react'
import { Table, Input, Select, Card, Modal, Descriptions, Button, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Search } = Input
const { Option } = Select

// TypeScript 类型定义
interface ProductItem {
  id: number
  product_name: string
  product_type: string
  latest_nav: number
  establish_scale: number
  product_status: string
  create_time: string
}

// 表单数据类型
interface FormData {
  product_name: string
  product_type: string
  latest_nav: number
  establish_scale: number
  product_status: string
}

export default function Product() {
  // 泛型约束类型
  const [productList, setProductList] = useState<ProductItem[]>([])
  const [filteredList, setFilteredList] = useState<ProductItem[]>([])
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<ProductItem | null>(null)
  
  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('新增产品')
  const [formData, setFormData] = useState<FormData>({
    product_name: '',
    product_type: '股票型',
    latest_nav: 1.0,
    establish_scale: 0,
    product_status: '募集中'
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // 多选相关
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 获取产品列表
  const getProductList = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/products')
      // console.log('产品列表响应:', res.data)
      setProductList(res.data)
      setFilteredList(res.data)
    } catch (error) {
      console.error('获取产品列表失败:', error)
    }
  }

  useEffect(() => {
    getProductList()
  }, [])

  // 搜索
  const handleSearch = (value: string) => {
    const result = productList.filter((item) =>
      item.product_name.includes(value)
    )
    setFilteredList(result)
  }

  // 按类型筛选
  const handleTypeChange = (value: string) => {
    if (!value) {
      setFilteredList(productList)
      return
    }
    const result = productList.filter((item) => item.product_type === value)
    setFilteredList(result)
  }

  // 按状态筛选
  const handleStatusChange = (value: string) => {
    if (!value) {
      setFilteredList(productList)
      return
    }
    const result = productList.filter((item) => item.product_status === value)
    setFilteredList(result)
  }

  // 查看详情
  const showDetail = (record: ProductItem) => {
    setCurrent(record)
    setVisible(true)
  }

  // 新增产品
  const handleAdd = () => {
    setModalTitle('新增产品')
    setEditingId(null)
    setFormData({
      product_name: '',
      product_type: '股票型',
      latest_nav: 1.0,
      establish_scale: 0,
      product_status: '募集中'
    })
    setModalVisible(true)
  }

  // 编辑产品
  const handleEdit = (record: ProductItem) => {
    setModalTitle('编辑产品')
    setEditingId(record.id)
    setFormData({
      product_name: record.product_name,
      product_type: record.product_type,
      latest_nav: record.latest_nav,
      establish_scale: record.establish_scale,
      product_status: record.product_status
    })
    setModalVisible(true)
  }

  // 删除产品
  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`http://localhost:3000/api/products/${id}`)
      message.success('删除成功')
      getProductList()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    try {
      await axios.post('http://localhost:3000/api/products/batch-delete', {
        ids: selectedRowKeys
      })
      message.success('批量删除成功')
      setSelectedRowKeys([])
      getProductList()
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      if (editingId) {
        // 编辑
        await axios.put(`http://localhost:3000/api/products/${editingId}`, formData)
        message.success('编辑成功')
      } else {
        // 新增
        await axios.post('http://localhost:3000/api/products', formData)
        message.success('新增成功')
      }
      setModalVisible(false)
      getProductList()
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 状态 Tag 颜色映射
  const getStatusTag = (status: string) => {
    const colorMap: Record<string, string> = {
      '募集中和': 'blue',
      '运作中': 'green',
      '已清盘': 'red'
    }
    const color = colorMap[status] || 'default'
    return <Tag color={color}>{status}</Tag>
  }

  // 表格列
  const columns = [
    { title: '产品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '产品类型', dataIndex: 'product_type', key: 'product_type' },
    { title: '最新净值', dataIndex: 'latest_nav', key: 'latest_nav' },
    { title: '成立规模(万)', dataIndex: 'establish_scale', key: 'establish_scale' },
    { title: '产品状态', dataIndex: 'product_status', key: 'product_status', render: (status: string) => getStatusTag(status) },
    {
      title: '操作',
      render: (_: any, record: ProductItem) => (
        <>
          <a onClick={() => showDetail(record)} style={{ marginRight: 8 }}>详情</a>
          <a onClick={() => handleEdit(record)} style={{ marginRight: 8 }}>编辑</a>
          <Popconfirm title="确定删除该产品?" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </>
      )
    }
  ]

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys)
  }

  return (
    <Card title="基金产品货架">
      {/* 搜索 + 筛选栏 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Search
          placeholder="搜索产品名称"
          style={{ width: 250 }}
          onSearch={handleSearch}
        />

        <Select
          placeholder="按产品类型筛选"
          style={{ width: 180 }}
          allowClear
          onChange={handleTypeChange}
        >
          <Option value="股票型">股票型</Option>
          <Option value="债券型">债券型</Option>
          <Option value="混合型">混合型</Option>
          <Option value="货币型">货币型</Option>
        </Select>

        <Select
          placeholder="按产品状态筛选"
          style={{ width: 180 }}
          allowClear
          onChange={handleStatusChange}
        >
          <Option value="募集中">募集中</Option>
          <Option value="运作中">运作中</Option>
          <Option value="已清盘">已清盘</Option>
        </Select>

        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增产品
        </Button>

        <Popconfirm title="确定删除选中的产品?" onConfirm={handleBatchDelete} okText="确定" cancelText="取消" disabled={selectedRowKeys.length === 0}>
          <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
            批量删除 ({selectedRowKeys.length})
          </Button>
        </Popconfirm>
      </div>

      {/* 产品表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredList}
        pagination={{ pageSize: 10 }}
        rowSelection={rowSelection}
      />

      {/* 产品详情弹窗 */}
      <Modal
        title="产品详情"
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={600}
      >
        {current && (
          <Descriptions column={1}>
            <Descriptions.Item label="产品名称">{current.product_name}</Descriptions.Item>
            <Descriptions.Item label="产品类型">{current.product_type}</Descriptions.Item>
            <Descriptions.Item label="最新净值">{current.latest_nav}</Descriptions.Item>
            <Descriptions.Item label="成立规模（万元）">{current.establish_scale}</Descriptions.Item>
            <Descriptions.Item label="产品状态">{current.product_status}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{current.create_time}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>产品名称：</label>
            <Input
              value={formData.product_name}
              onChange={e => setFormData({ ...formData, product_name: e.target.value })}
              placeholder="请输入产品名称"
            />
          </div>
          <div>
            <label>产品类型：</label>
            <Select
              value={formData.product_type}
              onChange={value => setFormData({ ...formData, product_type: value })}
              style={{ width: '100%' }}
            >
              <Option value="股票型">股票型</Option>
              <Option value="债券型">债券型</Option>
              <Option value="混合型">混合型</Option>
              <Option value="货币型">货币型</Option>
            </Select>
          </div>
          <div>
            <label>最新净值：</label>
            <Input
              type="number"
              value={formData.latest_nav}
              onChange={e => setFormData({ ...formData, latest_nav: parseFloat(e.target.value) || 0 })}
              placeholder="请输入最新净值"
            />
          </div>
          <div>
            <label>成立规模（万元）：</label>
            <Input
              type="number"
              value={formData.establish_scale}
              onChange={e => setFormData({ ...formData, establish_scale: parseFloat(e.target.value) || 0 })}
              placeholder="请输入成立规模"
            />
          </div>
          <div>
            <label>产品状态：</label>
            <Select
              value={formData.product_status}
              onChange={value => setFormData({ ...formData, product_status: value })}
              style={{ width: '100%' }}
            >
              <Option value="募集中">募集中</Option>
              <Option value="运作中">运作中</Option>
              <Option value="已清盘">已清盘</Option>
            </Select>
          </div>
        </div>
      </Modal>
    </Card>
  )
}