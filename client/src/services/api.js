import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined && response.data.data !== undefined) {
      const { data, meta, ...rest } = response.data;
      if (Array.isArray(data)) {
        response.data = { ...rest, data };
      } else {
        response.data = { ...rest, ...data };
      }
      if (meta) response.data.meta = meta;
    }
    return response;
  },
  (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post("/auth/login", data),
  getProfile: () => api.get("/auth/profile"),
  getUsers: (params) => api.get("/auth/users", { params }),
  createUser: (data) => api.post("/auth/users", data),
  updateUserStatus: (id, data) => api.patch(`/auth/users/${id}/status`, data),
};

export const estimateApi = {
  create: (data) => api.post("/estimates", data),
  getAll: (params) => api.get("/estimates", { params }),
  getById: (id) => api.get(`/estimates/${id}`),
  update: (id, data) => api.patch(`/estimates/${id}`, data),
  delete: (id) => api.delete(`/estimates/${id}`),
  updateStatus: (id, data) => api.patch(`/estimates/${id}/status`, data),
  getByStatus: (status) => api.get(`/estimates/status/${status}`),
  getMovements: (id) => api.get(`/estimates/${id}/movements`),
  createVersion: (id, data) => api.post(`/estimates/${id}/versions`, data),
};

export const itemApi = {
  search: (q, category) => {
    const params = { q };
    if (category) params.category = category;
    return api.get("/items/search", { params });
  },
  getAll: (params) => api.get("/items", { params }),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post("/items", data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

export const otpApi = {
  send: (data) => api.post("/otp/send", data),
  resend: (data) => api.post("/otp/resend", data),
  verify: (data) => api.post("/otp/verify", data),
};

export const pdfApi = {
  generateAbstract: (data) => api.post("/pdf/generate", data, { responseType: "blob" }),
  getAbstract: (estimateId) => api.get(`/pdf/${estimateId}`, { responseType: "blob" }),
};

export const hierarchyApi = {
  getRegions: () => api.get("/hierarchy/regions"),
  getZones: () => api.get("/hierarchy/zones"),
  getCircles: (zoneId) => api.get(`/hierarchy/zones/${zoneId}/circles`),
  getWards: (circleId) => api.get(`/hierarchy/circles/${circleId}/wards`),
};

export const reportApi = {
  getFilters: () => api.get("/reports/filters"),
  getReports: (params) => api.get("/reports", { params }),
  exportCsv: (params) => api.get("/reports/export/csv", { params, responseType: "blob" }),
  getAuditLogs: (params) => api.get("/reports/audit-logs", { params }),
  getDashboardStats: () => api.get("/reports/dashboard-stats"),
};

export const signatureApi = {
  verify: (estimateId) => api.get(`/signatures/verify/${estimateId}`),
  getByEstimate: (estimateId) => api.get(`/signatures/${estimateId}`),
  getHistory: (params) => api.get("/signatures", { params }),
  revoke: (estimateId, data) => api.patch(`/signatures/${estimateId}/revoke`, data),
};

export default api;
