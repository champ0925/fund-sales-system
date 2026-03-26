import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom'
import { Layout as AntLayout, Menu, Drawer, Button } from 'antd'
import { ProductOutlined, DashboardOutlined, UserOutlined, RobotOutlined, MenuOutlined } from '@ant-design/icons'
import Product from './pages/Product'
import Customer from './pages/Customer'
import Dashboard from './pages/Dashboard'
import AIAgent from './pages/AIAgent'

const { Header, Sider, Content } = AntLayout

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

function AppContent() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [drawerVisible, setDrawerVisible] = useState(false)

  const selectedKey = (() => {
    if (location.pathname === '/customer') return '2'
    if (location.pathname === '/dashboard') return '3'
    if (location.pathname === '/ai') return '4'
    return '1'
  })()

  const menuItems = [
    { key: '1', icon: <ProductOutlined />, label: <Link to="/product">产品货架</Link> },
    { key: '2', icon: <UserOutlined />, label: <Link to="/customer">客户管理</Link> },
    { key: '3', icon: <DashboardOutlined />, label: <Link to="/dashboard">数据概览</Link> },
    { key: '4', icon: <RobotOutlined />, label: <Link to="/ai">AI 智能助手</Link> },
  ]

  const handleMenuClick = () => {
    if (isMobile) {
      setDrawerVisible(false)
    }
  }

  // 移动端布局
  if (isMobile) {
    return (
      <AntLayout style={{ height: '100%', width: '100%' }}>
        <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerVisible(true)} />
          <span style={{ fontSize: '16px', fontWeight: 500 }}>基金销售系统</span>
          <div style={{ width: 40 }} />
        </Header>
        <Content style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
          <Routes>
            <Route path="/product" element={<Product />} />
            <Route path="/customer" element={<Customer />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai" element={<AIAgent />} />
            <Route path="*" element={<Product />} />
          </Routes>
        </Content>
        <Drawer
          title="基金销售系统"
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={250}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Drawer>
      </AntLayout>
    )
  }

  // 桌面端布局
  return (
    <AntLayout style={{ height: '100%', width: '100%' }}>
      <Sider width={220} style={{ background: '#fff' }}>
        <div style={{ padding: '20px', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
          基金销售系统
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} style={{ height: '100%', borderRight: 0 }} items={menuItems} />
      </Sider>

      <AntLayout style={{ height: '100%' }}>
        <Header style={{ background: '#fff' }} />
        <Content style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
          <Routes>
            <Route path="/product" element={<Product />} />
            <Route path="/customer" element={<Customer />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai" element={<AIAgent />} />
            <Route path="*" element={<Product />} />
          </Routes>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App