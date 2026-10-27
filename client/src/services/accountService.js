import api from "../lib/api";

export const accountService = {
  async getAccounts(params = {}) {
    const response = await api.get("/accounts", { params });
    return response.data;
  },

  async getAccount(id) {
    const response = await api.get(`/accounts/${id}`);
    return response.data;
  },

  async getAccountByNumber(accountNumber) {
    const response = await api.get(`/accounts/number/${accountNumber}`);
    return response.data;
  },

  async createAccount(data) {
    const response = await api.post("/accounts", data);
    return response.data;
  },

  async updateAccount(id, data) {
    const response = await api.put(`/accounts/${id}`, data);
    return response.data;
  },

  async closeAccount(id) {
    const response = await api.delete(`/accounts/${id}`);
    return response.data;
  },

  async getAccountSummary(id) {
    const response = await api.get(`/accounts/${id}/summary`);
    return response.data;
  },

  async getAccountStatement(id, params = {}) {
    const response = await api.get(`/accounts/${id}/statement`, { params });
    return response.data;
  },

  async getBeneficiaries(accountId) {
    const response = await api.get(`/accounts/${accountId}/beneficiaries`);
    return response.data;
  },

  async addBeneficiary(accountId, data) {
    const response = await api.post(
      `/accounts/${accountId}/beneficiaries`,
      data,
    );
    return response.data;
  },

  async removeBeneficiary(accountId, beneficiaryId) {
    const response = await api.delete(
      `/accounts/${accountId}/beneficiaries/${beneficiaryId}`,
    );
    return response.data;
  },
};
