import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './Button';

export const ExportButton = ({
  exportFn,
  label = 'Export CSV',
  successMessage = 'File downloaded successfully',
  errorMessage = 'Export failed',
  variant = 'outline',
  size = 'md',
  disabled = false,
  icon: Icon = Download,
}) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportFn();
      toast.success(successMessage);
    } catch (err) {
      const msg = err.response?.data?.message || errorMessage;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || loading}
      leftIcon={loading ? Loader2 : Icon}
      className={loading ? '[&_svg]:animate-spin' : ''}
    >
      {loading ? 'Exporting...' : label}
    </Button>
  );
};