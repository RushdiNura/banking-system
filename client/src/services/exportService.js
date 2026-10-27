import api from '../lib/api';
import { downloadFile } from '../lib/utils';

const parseFilename = (headers, fallback) => {
  const cd = headers['content-disposition'] || headers['Content-Disposition'];
  if (!cd) return fallback;
  const match = /filename="?([^"]+)"?/.exec(cd);
  return match?.[1] || fallback;
};

const download = (response, fallbackName) => {
  const filename = parseFilename(response.headers, fallbackName);
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename);
};

export const exportService = {
  async transactions(params = {}) {
    const response = await api.get('/export/transactions', {
      params,
      responseType: 'blob',
    });
    download(response, `transactions-${Date.now()}.csv`);
    return response;
  },
  async accounts(params = {}) {
    const response = await api.get('/export/accounts', {
      params,
      responseType: 'blob',
    });
    download(response, `accounts-${Date.now()}.csv`);
    return response;
  },
  async loans(params = {}) {
    const response = await api.get('/export/loans', {
      params,
      responseType: 'blob',
    });
    download(response, `loans-${Date.now()}.csv`);
    return response;
  },
};