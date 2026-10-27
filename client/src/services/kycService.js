import api from "../lib/api";

export const kycService = {
  // Get all pending KYC submissions (employee/admin)
  async getPending() {
    const response = await api.get("/kyc/pending");
    return response.data;
  },

  // Get a single user's KYC details
  async getDetails(userId) {
    const response = await api.get(`/kyc/${userId}`);
    return response.data;
  },

  // Approve or reject
  async review(userId, decision, reason = "") {
    const response = await api.put(`/kyc/${userId}/review`, {
      decision,
      reason,
    });
    return response.data;
  },
};
