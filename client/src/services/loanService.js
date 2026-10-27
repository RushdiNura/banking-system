import api from "../lib/api";

export const loanService = {
  async getLoans(params = {}) {
    const response = await api.get("/loans", { params });
    return response.data;
  },

  async getAllLoans(params = {}) {
    const response = await api.get("/loans/admin/all", { params });
    return response.data;
  },

  async getLoan(id) {
    const response = await api.get(`/loans/${id}`);
    return response.data;
  },

  async applyForLoan(data) {
    const response = await api.post("/loans/apply", data);
    return response.data;
  },

  async approveLoan(id) {
    const response = await api.put(`/loans/${id}/approve`);
    return response.data;
  },

  async rejectLoan(id, reason) {
    const response = await api.put(`/loans/${id}/reject`, { reason });
    return response.data;
  },

  async disburseLoan(id) {
    const response = await api.post(`/loans/${id}/disburse`);
    return response.data;
  },

  async makeLoanPayment(id, data) {
    const response = await api.post(`/loans/${id}/pay`, data);
    return response.data;
  },

  async getEMISchedule(id) {
    const response = await api.get(`/loans/${id}/emi-schedule`);
    return response.data;
  },

  async getStats(params = {}) {
    const response = await api.get("/loans/stats", { params });
    return response.data;
  },
};
