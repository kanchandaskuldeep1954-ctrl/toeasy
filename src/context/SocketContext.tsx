
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    onlineUsers: string[]; // List of user IDs
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    onlineUsers: []
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    // Backend URL from env or default
    // Socket.IO needs root URL, not /api path - strip /api suffix if present
    const SOCKET_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

    useEffect(() => {
        if (loading) return;

        if (user) {
            // Initialize Socket
            const socketInstance = io(SOCKET_URL, {
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                autoConnect: true,
                withCredentials: true
            });

            socketInstance.on('connect', () => {
                console.log('[Socket] Connected:', socketInstance.id);
                setIsConnected(true);

                // Authenticate
                socketInstance.emit('authenticate', {
                    userId: user.id,
                    userName: user.name,
                    token: localStorage.getItem('auth_token')
                });
            });

            socketInstance.on('disconnect', () => {
                console.log('[Socket] Disconnected');
                setIsConnected(false);
            });

            socketInstance.on('connect_error', (err) => {
                console.error('[Socket] Connection Error:', err.message);
            });

            // Listen for global events
            socketInstance.on('user-status-change', (data: { userId: string, status: string }) => {
                // Update online users list logic here (simplified)
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
        }
    }, [user, loading]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};
