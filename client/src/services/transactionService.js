import api from "../lib/api";

export const transactionService = {
  async getTransactions(params = {}) {
    const response = await api.get("/transactions", { params });
    return response.data;
  },

  async getTransaction(id) {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  async transfer(data, idempotencyKey) {
    const response = await api.post("/transactions/transfer", data, {
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    });
    return response.data;
  },

  async deposit(data) {
    const response = await api.post("/transactions/deposit", data);
    return response.data;
  },

  async withdraw(data) {
    const response = await api.post("/transactions/withdraw", data);
    return response.data;
  },

  async reverseTransaction(id, reason) {
    const response = await api.post(`/transactions/${id}/reverse`, { reason });
    return response.data;
  },

  async getStats(params = {}) {
    const response = await api.get("/transactions/stats", { params });
    return response.data;
  },
};
