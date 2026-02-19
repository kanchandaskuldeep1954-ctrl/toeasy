import type { Server } from 'socket.io';

let realtimeServer: Server | null = null;

export function setRealtimeServer(io: Server) {
  realtimeServer = io;
}

export function getRealtimeServer(): Server | null {
  return realtimeServer;
}

export function emitToUser(userId: string | number, event: string, payload: any) {
  if (!realtimeServer) return;
  realtimeServer.to(`user:${String(userId)}`).emit(event, payload);
}

export function emitToWorkspace(workspaceId: string | number, event: string, payload: any) {
  if (!realtimeServer) return;
  realtimeServer.to(`workspace:${String(workspaceId)}`).emit(event, payload);
}

export function emitToDecisionRoom(workspaceId: string | number, roomId: string | number, event: string, payload: any) {
  if (!realtimeServer) return;
  realtimeServer.to(`decision-room:${String(workspaceId)}:${String(roomId)}`).emit(event, payload);
}
