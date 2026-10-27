import api, { setTokens, clearTokens } from "../lib/api";

export const authService = {
  async register(userData) {
    const response = await api.post("/auth/register", userData);
    if (response.data.data.token) {
      setTokens(response.data.data.token, response.data.data.refreshToken);
    }
    return response.data;
  },

  async login(credentials) {
    const response = await api.post("/auth/login", credentials);
    if (response.data.data.token) {
      setTokens(
        response.data.data.token,
        response.data.data.refreshToken || localStorage.getItem("refreshToken"),
      );
    }
    return response.data;
  },

  async logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      clearTokens();
    }
  },

  async getMe() {
    const response = await api.get("/auth/me");
    return response.data;
  },

  async updateProfile(data) {
    const response = await api.put("/auth/profile", data);
    return response.data;
  },

  async changePassword(data) {
    const response = await api.put("/auth/change-password", data);
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  },

  async resetPassword(token, password) {
    const response = await api.put(`/auth/reset-password/${token}`, {
      password,
    });
    return response.data;
  },

  async verifyEmail(token) {
    const response = await api.get(`/auth/verify-email/${token}`);
    return response.data;
  },

  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append("profilePicture", file);
    const response = await api.post("/auth/profile-picture", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async uploadKYC(files, documentTypes) {
    const formData = new FormData();
    files.forEach((file) => formData.append("documents", file));
    formData.append("documentTypes", JSON.stringify(documentTypes));
    const response = await api.post("/auth/kyc", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};
