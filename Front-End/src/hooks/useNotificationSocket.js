import { useEffect, useRef } from "react";
import socket from "../socket";

// The JWT itself is the reliable source of the user id — it works for
// every login path (password, QR) without depending on something else
// having separately stashed a "userId" key in localStorage first.
const decodeUserIdFromToken = (token) => {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.id || null;
  } catch {
    return null;
  }
};

/**
 * Connects to the backend's existing Socket.IO server (already used for
 * QR login) and joins this user's personal room so `onNewNotification`
 * fires the moment the backend creates one — a deposit clearing, a
 * withdrawal confirming, an order filling, etc. — without a page refresh.
 */
const useNotificationSocket = (onNewNotification) => {
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = token ? decodeUserIdFromToken(token) : null;

    if (!userId) return;

    if (!socket.connected) socket.connect();

    // The server verifies the JWT itself; the id we decoded is only used
    // to decide whether there is anyone logged in to subscribe.
    socket.emit("join_user", token);

    const handleNewNotification = (notification) => {
      callbackRef.current?.(notification);
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, []);
};

export default useNotificationSocket;
