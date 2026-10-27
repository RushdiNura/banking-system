import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

export const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatDate = (date, options = {}) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...options,
  }).format(new Date(date));
};

export const formatDateTime = (date) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};

export const formatRelativeTime = (date) => {
  if (!date) return "";
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const maskAccountNumber = (accountNumber) => {
  if (!accountNumber) return "";
  return `****${accountNumber.slice(-4)}`;
};

export const formatAccountNumber = (accountNumber) => {
  if (!accountNumber) return "";
  return accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ");
};

export const getInitials = (firstName, lastName) => {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

export const getStatusColor = (status) => {
  const map = {
    active: "success",
    completed: "success",
    approved: "success",
    verified: "success",
    pending: "warning",
    processing: "warning",
    inactive: "default",
    frozen: "danger",
    closed: "default",
    failed: "danger",
    rejected: "danger",
    cancelled: "danger",
    reversed: "warning",
    defaulted: "danger",
  };
  return map[status?.toLowerCase()] || "default";
};

export const truncate = (str, length = 50) => {
  if (!str) return "";
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

export const generateIdempotencyKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
