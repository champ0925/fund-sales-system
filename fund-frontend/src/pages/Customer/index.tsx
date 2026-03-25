import { useState, useEffect } from 'react'
import { Table, Button, Card, Tabs, Input, Modal, message, Popconfirm, Select } from 'antd'
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import apiConfig from '../../utils/api'

const { Search } = Input
const { Option } = Select
const { TabPane } = Tabs
// const { RangePicker } = DatePicker // 已注释

// TypeScript 类型定义
interface Customer {
  id: number
  customer_name: string
  phone: string
  company: string
  customer_status: string
  create_time: string
}

interface Product {
  id: number
  product_id: number
  product_name: string
  product_type: string
  hold_amount: number
  buy_time: string
}

interface Follow {
  id: number
  follow_way: string
  follow_content: string
  follow_time: string
  next_plan: string
}

interface AllProduct {
  id: number
  product_name: string
  product_type: string
}

// 表单数据类型
interface CustomerFormData {
  customer_name: string
  phone: string
  company: string
  customer_status: string
}

interface HoldFormData {
  product_id: number
  hold_amount: number
  buy_time: string
}

interface FollowFormData {
  follow_way: string
  follow_content: string
  follow_time: string
  next_plan: string
}

export default function Customer() {
  const [list, setList] = useState<Customer[]>([])
  const [filteredList, setFilteredList] = useState<Customer[]>([])
  const [allProducts, setAllProducts] = useState<AllProduct[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [currentCustomerName, setCurrentCustomerName] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [follows, setFollows] = useState<Follow[]>([])
  
  // 客户 Modal 相关状态
  const [customerModalVisible, setCustomerModalVisible] = useState(false)
  const [customerModalTitle, setCustomerModalTitle] = useState('新增客户')
  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
    customer_name: '',
    phone: '',
    company: '',
    customer_status: '意向'
  })
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)
  
  // 持有产品 Modal 相关状态
  const [holdModalVisible, setHoldModalVisible] = useState(false)
  const [holdModalTitle, setHoldModalTitle] = useState('新增持有产品')
  const [holdFormData, setHoldFormData] = useState<HoldFormData>({
    product_id: 0,
    hold_amount: 0,
    buy_time: dayjs().format('YYYY-MM-DD')
  })
  const [editingHoldId, setEditingHoldId] = useState<number | null>(null)
  
  // 跟进记录 Modal 相关状态
  const [followModalVisible, setFollowModalVisible] = useState(false)
  const [followModalTitle, setFollowModalTitle] = useState('新增跟进记录')
  const [followFormData, setFollowFormData] = useState<FollowFormData>({
    follow_way: '电话',
    follow_content: '',
    follow_time: dayjs().format('YYYY-MM-DD'),
    next_plan: ''
  })
  const [editingFollowId, setEditingFollowId] = useState<number | null>(null)
  
  // 多选相关
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedProductKeys, setSelectedProductKeys] = useState<React.Key[]>([])
  const [selectedFollowKeys, setSelectedFollowKeys] = useState<React.Key[]>([])

  // 获取客户列表
  const getList = async () => {
    try {
      const res = await axios.get(apiConfig.endpoints.customers)
      setList(res.data)
      setFilteredList(res.data)
    } catch (error) {
      console.error('获取客户列表失败:', error)
    }
  }

  // 获取所有产品列表（用于选择）
  const getAllProducts = async () => {
    try {
      const res = await axios.get(apiConfig.endpoints.products)
      setAllProducts(res.data)
    } catch (error) {
      console.error('获取产品列表失败:', error)
    }
  }

  // 获取客户持有产品
  const getProducts = async (id: number) => {
    try {
      const res = await axios.get(apiConfig.endpoints.customerProducts(id))
      setProducts(res.data)
    } catch (error) {
      console.error('获取客户产品失败:', error)
    }
  }

  // 获取客户跟进记录
  const getFollows = async (id: number) => {
    try {
      const res = await axios.get(apiConfig.endpoints.followCustomer(id))
      setFollows(res.data)
    } catch (error) {
      console.error('获取客户跟进记录失败:', error)
    }
  }

  useEffect(() => {
    getList()
    getAllProducts()
  }, [])

  // 搜索
  const handleSearch = (value: string) => {
    const result = list.filter((item) =>
      item.customer_name.includes(value) || item.company.includes(value)
    )
    setFilteredList(result)
  }

  // ===== 客户操作 =====
  const handleAddCustomer = () => {
    setCustomerModalTitle('新增客户')
    setEditingCustomerId(null)
    setCustomerFormData({
      customer_name: '',
      phone: '',
      company: '',
      customer_status: '意向'
    })
    setCustomerModalVisible(true)
  }

  const handleEditCustomer = (record: Customer) => {
    setCustomerModalTitle('编辑客户')
    setEditingCustomerId(record.id)
    setCustomerFormData({
      customer_name: record.customer_name,
      phone: record.phone,
      company: record.company,
      customer_status: record.customer_status
    })
    setCustomerModalVisible(true)
  }

  const handleDeleteCustomer = async (id: number) => {
    try {
      await axios.delete(`${apiConfig.endpoints.customers}/${id}`)
      message.success('删除成功')
      // 如果删除的是当前查看的客户，关闭详情
      if (currentId === id) {
        setCurrentId(null)
        setCurrentCustomerName('')
        setProducts([])
        setFollows([])
      }
      getList()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleBatchDeleteCustomer = async () => {
    try {
      await axios.post(apiConfig.endpoints.customerBatchDelete, {
        ids: selectedRowKeys
      })
      message.success('批量删除成功')
      setSelectedRowKeys([])
      getList()
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  const handleSubmitCustomer = async () => {
    try {
      if (editingCustomerId) {
        await axios.put(`${apiConfig.endpoints.customers}/${editingCustomerId}`, customerFormData)
        message.success('编辑成功')
      } else {
        await axios.post(apiConfig.endpoints.customers, customerFormData)
        message.success('新增成功')
      }
      setCustomerModalVisible(false)
      getList()
    } catch (error) {
      message.error('操作失败')
    }
  }

  // ===== 持有产品操作 =====
  const handleAddHold = () => {
    setHoldModalTitle('新增持有产品')
    setEditingHoldId(null)
    setHoldFormData({
      product_id: 0,
      hold_amount: 0,
      buy_time: dayjs().format('YYYY-MM-DD')
    })
    setHoldModalVisible(true)
  }

  const handleEditHold = (record: Product) => {
    setHoldModalTitle('编辑持有产品')
    setEditingHoldId(record.id)
    setHoldFormData({
      product_id: record.product_id,
      hold_amount: record.hold_amount,
      buy_time: record.buy_time ? record.buy_time.split('T')[0] : dayjs().format('YYYY-MM-DD')
    })
    setHoldModalVisible(true)
  }

  const handleDeleteHold = async (id: number) => {
    try {
      await axios.delete(apiConfig.endpoints.customerHoldDetail(id))
      message.success('删除成功')
      if (currentId) getProducts(currentId)
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleBatchDeleteHold = async () => {
    try {
      await axios.post(apiConfig.endpoints.customerHoldBatchDelete, {
        ids: selectedProductKeys
      })
      message.success('批量删除成功')
      setSelectedProductKeys([])
      if (currentId) getProducts(currentId)
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  const handleSubmitHold = async () => {
    try {
      if (editingHoldId) {
        await axios.put(apiConfig.endpoints.customerHoldDetail(editingHoldId), holdFormData)
        message.success('编辑成功')
      } else {
        await axios.post(apiConfig.endpoints.customerHold, {
          customer_id: currentId,
          ...holdFormData
        })
        message.success('新增成功')
      }
      setHoldModalVisible(false)
      if (currentId) getProducts(currentId)
    } catch (error) {
      message.error('操作失败')
    }
  }

  // ===== 跟进记录操作 =====
  const handleAddFollow = () => {
    setFollowModalTitle('新增跟进记录')
    setEditingFollowId(null)
    setFollowFormData({
      follow_way: '电话',
      follow_content: '',
      follow_time: dayjs().format('YYYY-MM-DD'),
      next_plan: ''
    })
    setFollowModalVisible(true)
  }

  const handleEditFollow = (record: Follow) => {
    setFollowModalTitle('编辑跟进记录')
    setEditingFollowId(record.id)
    setFollowFormData({
      follow_way: record.follow_way,
      follow_content: record.follow_content,
      follow_time: record.follow_time ? record.follow_time.split('T')[0] : dayjs().format('YYYY-MM-DD'),
      next_plan: record.next_plan
    })
    setFollowModalVisible(true)
  }

  const handleDeleteFollow = async (id: number) => {
    try {
      await axios.delete(apiConfig.endpoints.followDetail(id))
      message.success('删除成功')
      if (currentId) getFollows(currentId)
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleBatchDeleteFollow = async () => {
    try {
      await axios.post(apiConfig.endpoints.followBatchDelete, {
        ids: selectedFollowKeys
      })
      message.success('批量删除成功')
      setSelectedFollowKeys([])
      if (currentId) getFollows(currentId)
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  const handleSubmitFollow = async () => {
    try {
      if (editingFollowId) {
        await axios.put(apiConfig.endpoints.followDetail(editingFollowId), followFormData)
        message.success('编辑成功')
      } else {
        await axios.post(apiConfig.endpoints.followAdd, {
          customer_id: currentId,
          ...followFormData
        })
        message.success('新增成功')
      }
      setFollowModalVisible(false)
      if (currentId) getFollows(currentId)
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 表格列
  const customerColumns = [
    { title: '客户姓名', dataIndex: 'customer_name' },
    { title: '电话', dataIndex: 'phone' },
    { title: '公司', dataIndex: 'company' },
    { title: '状态', dataIndex: 'customer_status' },
    {
      title: '操作',
      render: (_: any, record: Customer) => (
        <>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setCurrentId(record.id)
              setCurrentCustomerName(record.customer_name)
              getProducts(record.id)
              getFollows(record.id)
            }}
            style={{ marginRight: 8 }}
          >
            详情
          </Button>
          <Button size="small" onClick={() => handleEditCustomer(record)} style={{ marginRight: 8 }}>
            编辑
          </Button>
          <Popconfirm title="确定删除该客户?" onConfirm={() => handleDeleteCustomer(record.id)} okText="确定" cancelText="取消">
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </>
      )
    }
  ]

  const holdColumns = [
    { title: '产品名称', dataIndex: 'product_name' },
    { title: '类型', dataIndex: 'product_type' },
    { title: '持有金额(万)', dataIndex: 'hold_amount' },
    { title: '购买时间', dataIndex: 'buy_time', render: (text: string) => text ? text.split('T')[0] : '-' },
    {
      title: '操作',
      render: (_: any, record: Product) => (
        <>
          <a onClick={() => handleEditHold(record)} style={{ marginRight: 8 }}>编辑</a>
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteHold(record.id)} okText="确定" cancelText="取消">
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </>
      )
    }
  ]

  const followColumns = [
    { title: '方式', dataIndex: 'follow_way' },
    { title: '内容', dataIndex: 'follow_content', ellipsis: true },
    { title: '时间', dataIndex: 'follow_time', render: (text: string) => text ? text.split('T')[0] : '-' },
    { title: '下次计划', dataIndex: 'next_plan', ellipsis: true },
    {
      title: '操作',
      render: (_: any, record: Follow) => (
        <>
          <a onClick={() => handleEditFollow(record)} style={{ marginRight: 8 }}>编辑</a>
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteFollow(record.id)} okText="确定" cancelText="取消">
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </>
      )
    }
  ]

  const rowSelection = { selectedRowKeys, onChange: (keys: React.Key[]) => setSelectedRowKeys(keys) }
  const productRowSelection = { selectedRowKeys: selectedProductKeys, onChange: (keys: React.Key[]) => setSelectedProductKeys(keys) }
  const followRowSelection = { selectedRowKeys: selectedFollowKeys, onChange: (keys: React.Key[]) => setSelectedFollowKeys(keys) }

  return (
    <Card title="客户管理">
      {/* 搜索 + 操作栏 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Search placeholder="搜索客户姓名/公司" style={{ width: 250 }} onSearch={handleSearch} />
        <Button icon={<ReloadOutlined />} onClick={() => getList()}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomer}>新增客户</Button>
        <Popconfirm title="确定删除选中的客户?" onConfirm={handleBatchDeleteCustomer} okText="确定" cancelText="取消" disabled={selectedRowKeys.length === 0}>
          <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>批量删除 ({selectedRowKeys.length})</Button>
        </Popconfirm>
      </div>

      {/* 客户表格 */}
      <Table rowKey="id" columns={customerColumns} dataSource={filteredList} pagination={{ pageSize: 10 }} rowSelection={rowSelection} />

      {/* 客户详情 */}
      {currentId && (
        <Card style={{ marginTop: 20 }} title={`${currentCustomerName}-客户详情`}>
          <Tabs>
            <TabPane tab="持有产品" key="1">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddHold} style={{ marginRight: 8 }}>新增持有产品</Button>
                <Popconfirm title="确定删除选中的产品?" onConfirm={handleBatchDeleteHold} okText="确定" cancelText="取消" disabled={selectedProductKeys.length === 0}>
                  <Button danger icon={<DeleteOutlined />} disabled={selectedProductKeys.length === 0}>批量删除 ({selectedProductKeys.length})</Button>
                </Popconfirm>
              </div>
              <Table rowKey="id" columns={holdColumns} dataSource={products} pagination={{ pageSize: 5 }} rowSelection={productRowSelection} />
            </TabPane>

            <TabPane tab="跟进记录" key="2">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFollow} style={{ marginRight: 8 }}>新增跟进记录</Button>
                <Popconfirm title="确定删除选中的记录?" onConfirm={handleBatchDeleteFollow} okText="确定" cancelText="取消" disabled={selectedFollowKeys.length === 0}>
                  <Button danger icon={<DeleteOutlined />} disabled={selectedFollowKeys.length === 0}>批量删除 ({selectedFollowKeys.length})</Button>
                </Popconfirm>
              </div>
              <Table rowKey="id" columns={followColumns} dataSource={follows} pagination={{ pageSize: 5 }} rowSelection={followRowSelection} />
            </TabPane>
          </Tabs>
        </Card>
      )}

      {/* 客户表单弹窗 */}
      <Modal title={customerModalTitle} open={customerModalVisible} onCancel={() => setCustomerModalVisible(false)} onOk={handleSubmitCustomer} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>客户姓名：</label>
            <Input value={customerFormData.customer_name} onChange={e => setCustomerFormData({ ...customerFormData, customer_name: e.target.value })} placeholder="请输入客户姓名" />
          </div>
          <div>
            <label>电话：</label>
            <Input value={customerFormData.phone} onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })} placeholder="请输入电话号码" />
          </div>
          <div>
            <label>公司：</label>
            <Input value={customerFormData.company} onChange={e => setCustomerFormData({ ...customerFormData, company: e.target.value })} placeholder="请输入公司名称" />
          </div>
          <div>
            <label>客户状态：</label>
            <Select value={customerFormData.customer_status} onChange={value => setCustomerFormData({ ...customerFormData, customer_status: value })} style={{ width: '100%' }}>
              <Option value="意向">意向</Option>
              <Option value="合作">合作</Option>
              <Option value="流失">流失</Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* 持有产品表单弹窗 */}
      <Modal title={holdModalTitle} open={holdModalVisible} onCancel={() => setHoldModalVisible(false)} onOk={handleSubmitHold} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>选择产品：</label>
            <Select value={holdFormData.product_id || undefined} onChange={value => setHoldFormData({ ...holdFormData, product_id: value })} style={{ width: '100%' }} placeholder="请选择产品">
              {allProducts.map(p => <Option key={p.id} value={p.id}>{p.product_name} ({p.product_type})</Option>)}
            </Select>
          </div>
          <div>
            <label>持有金额（万元）：</label>
            <Input type="number" value={holdFormData.hold_amount} onChange={e => setHoldFormData({ ...holdFormData, hold_amount: parseFloat(e.target.value) || 0 })} placeholder="请输入持有金额" />
          </div>
          <div>
            <label>购买时间：</label>
            <Input type="date" value={holdFormData.buy_time} onChange={e => setHoldFormData({ ...holdFormData, buy_time: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* 跟进记录表单弹窗 */}
      <Modal title={followModalTitle} open={followModalVisible} onCancel={() => setFollowModalVisible(false)} onOk={handleSubmitFollow} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>跟进方式：</label>
            <Select value={followFormData.follow_way} onChange={value => setFollowFormData({ ...followFormData, follow_way: value })} style={{ width: '100%' }}>
              <Option value="电话">电话</Option>
              <Option value="微信">微信</Option>
              <Option value="面谈">面谈</Option>
            </Select>
          </div>
          <div>
            <label>跟进内容：</label>
            <Input.TextArea value={followFormData.follow_content} onChange={e => setFollowFormData({ ...followFormData, follow_content: e.target.value })} placeholder="请输入跟进内容" rows={3} />
          </div>
          <div>
            <label>跟进时间：</label>
            <Input type="date" value={followFormData.follow_time} onChange={e => setFollowFormData({ ...followFormData, follow_time: e.target.value })} />
          </div>
          <div>
            <label>下次计划：</label>
            <Input value={followFormData.next_plan} onChange={e => setFollowFormData({ ...followFormData, next_plan: e.target.value })} placeholder="请输入下次计划" />
          </div>
        </div>
      </Modal>
    </Card>
  )
}