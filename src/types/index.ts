export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
  database: 'connected' | 'connecting' | 'disconnecting' | 'disconnected';
}
