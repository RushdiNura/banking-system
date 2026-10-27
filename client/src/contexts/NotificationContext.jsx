import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Map each notification type to the query-key prefixes that should be invalidated.
// React Query matches by prefix, so ['account'] invalidates ['account', id] too.
const QUERIES_TO_INVALIDATE = {
  transaction: [
    'accounts',
    'account',
    'account-summary',
    'account-transactions',
    'transactions',
    'transaction',
    'transaction-stats',
  ],
  loan: [
    'loans',
    'loan',
    'loan-emi',
    'admin-loans',
    'admin-loans-all',
    'accounts',
    'account',
    'account-summary',
    'account-transactions',
    'transactions',
  ],
  alert: [
    'accounts',
    'account',
    'account-summary',
  ],
  system: [
    'kyc-pending',
    'users',
    'admin-users',
    'auth-me',
    'user',
    'admin',
    'admin-users',
    'admin-security-stats',
    'admin-security-users',
  ],
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      const data = response.data.data || [];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch (error) {
      // silent fail — user might not be logged in
    }
  }, []);

  const handleNotification = useCallback(
    (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);

      // Show toast
      const toastFn =
        notification.variant === 'success'
          ? toast.success
          : notification.variant === 'error'
          ? toast.error
          : toast;
      toastFn(notification.title, { duration: 5000 });

      // Invalidate related queries (with refetchType: 'all' to force refetch even if not mounted)
      const queries = QUERIES_TO_INVALIDATE[notification.type] || [];
      queries.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' });
      });

      // Always refresh auth state
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['user'], refetchType: 'all' });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setNotifications([]);
      setUnreadCount(0);
      setIsConnected(false);
      return;
    }

    const socket = connectSocket();
    if (!socket) return;
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('notification', handleNotification);

    loadNotifications();

    return () => {
      socket.off('notification', handleNotification);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [isAuthenticated, handleNotification, loadNotifications]);

  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    const socket = getSocket();
    if (socket?.connected) socket.emit('mark-read', id);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
      toast.success('Notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearAll,
    reload: loadNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
};