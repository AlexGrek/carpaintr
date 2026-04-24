import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authFetchJson } from "../utils/authFetch";

const POLL_INTERVAL_MS = 15 * 1000;

const NotificationCountContext = createContext({ unreadCount: 0 });

export const useNotificationCount = () => useContext(NotificationCountContext);

export const NotificationCountProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!localStorage.getItem("authToken")) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await authFetchJson("/api/v1/notifications/unread-count");
      setUnreadCount(data?.count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCount]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationCountContext.Provider>
  );
};
