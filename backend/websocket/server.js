const signageConnections = new Map();

export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const signageId = url.pathname.split('/').pop();

    if (!signageId) {
      ws.close(1008, 'Signage ID required');
      return;
    }

    if (!signageConnections.has(signageId)) {
      signageConnections.set(signageId, new Set());
    }
    signageConnections.get(signageId).add(ws);

    ws.send(JSON.stringify({ type: 'connected', signageId }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const connections = signageConnections.get(signageId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) signageConnections.delete(signageId);
      }
    });

    ws.on('error', (err) => console.error('WebSocket error:', err));
  });
}

export function broadcastToSignage(signageId, message) {
  const connections = signageConnections.get(signageId);
  if (connections) {
    const msg = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === 1) ws.send(msg);
    });
  }
}
