import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom'
import { Layout as AntLayout, Menu } from 'antd'
import { ProductOutlined, DashboardOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import Product from './pages/Product'
import Customer from './pages/Customer'
import Dashboard from './pages/Dashboard'
import AIAgent from './pages/AIAgent'

const { Header, Sider, Content } = AntLayout

function AppContent() {
  const location = useLocation()
  const selectedKey = (() => {
    if (location.pathname === '/customer') return '2'
    if (location.pathname === '/dashboard') return '3'
    if (location.pathname === '/ai') return '4'
    return '1'
  })()

  return (
    <AntLayout style={{ height: '100%', width: '100%' }}>
      <Sider width={220} style={{ background: '#fff' }}>
        <div style={{ padding: '20px', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
          基金销售系统
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} style={{ height: '100%', borderRight: 0 }}>
          <Menu.Item key="1" icon={<ProductOutlined />}><Link to="/product">产品货架</Link></Menu.Item>
          <Menu.Item key="2" icon={<UserOutlined />}><Link to="/customer">客户管理</Link></Menu.Item>
          <Menu.Item key="3" icon={<DashboardOutlined />}><Link to="/dashboard">数据概览</Link></Menu.Item>
          <Menu.Item key="4" icon={<RobotOutlined />}><Link to="/ai">AI 智能助手</Link></Menu.Item>
        </Menu>
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