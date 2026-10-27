// server/utils/csvGenerator.js

export const escapeCSV = (value, delimiter = ",") => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) value = value.toISOString();
  if (typeof value === "object") {
    try {
      value = JSON.stringify(value);
    } catch {
      value = String(value);
    }
  }
  const str = String(value);
  const needsQuotes =
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r");
  if (needsQuotes) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export const generateCSV = (rows, columns, options = {}) => {
  const { delimiter = ",", includeHeaders = true, bom = true } = options;
  const lines = [];

  if (includeHeaders) {
    const headerLine = columns
      .map((col) => escapeCSV(col.label || col.key, delimiter))
      .join(delimiter);
    lines.push(headerLine);
  }

  for (const row of rows) {
    const line = columns
      .map((col) => {
        let value = row[col.key];
        if (col.formatter) value = col.formatter(value, row);
        return escapeCSV(value, delimiter);
      })
      .join(delimiter);
    lines.push(line);
  }

  const csv = lines.join("\r\n");
  return bom ? "\uFEFF" + csv : csv;
};

export const formatCurrencyCSV = (amount, currency = "USD") => {
  const n = Number(amount || 0);
  return `${currency} ${n.toFixed(2)}`;
};

export const formatDateCSV = (date) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

export const formatDateTimeCSV = (date) => {
  if (!date) return "";
  return new Date(date).toISOString().replace("T", " ").substring(0, 19);
};

export const setCSVHeaders = (res, filename) => {
  const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, "_");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

export default {
  escapeCSV,
  generateCSV,
  formatCurrencyCSV,
  formatDateCSV,
  formatDateTimeCSV,
  setCSVHeaders,
};
