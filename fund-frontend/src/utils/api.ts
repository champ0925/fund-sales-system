const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    // 客户相关
    customers: `${API_BASE_URL}/customers`,
    customerProducts: (id: number) => `${API_BASE_URL}/customers/${id}/products`,
    customerBatchDelete: `${API_BASE_URL}/customers/batch-delete`,
    
    // 产品相关
    products: `${API_BASE_URL}/products`,
    productDetail: (id: number) => `${API_BASE_URL}/products/${id}`,
    productBatchDelete: `${API_BASE_URL}/products/batch-delete`,
    
    // 客户持有产品
    customerHold: `${API_BASE_URL}/customer-hold`,
    customerHoldDetail: (id: number) => `${API_BASE_URL}/customer-hold/${id}`,
    customerHoldBatchDelete: `${API_BASE_URL}/customer-hold/batch-delete`,
    
    // 跟进记录
    follow: `${API_BASE_URL}/follow`,
    followDetail: (id: number) => `${API_BASE_URL}/follow/${id}`,
    followCustomer: (id: number) => `${API_BASE_URL}/follow/customer/${id}`,
    followBatchDelete: `${API_BASE_URL}/follow/batch-delete`,
    followAdd: `${API_BASE_URL}/follow/add`,
    
    // 仪表盘
    dashboardProductType: `${API_BASE_URL}/dashboard/product-type`,
    
    // AI
    aiChat: `${API_BASE_URL}/ai/chat`
  }
}

export default apiConfig