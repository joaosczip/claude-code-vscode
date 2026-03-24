import * as http from 'http';
import * as net from 'net';
import * as crypto from 'crypto';
import * as vscode from 'vscode';

export interface McpServer {
  port: number;
  authToken: string;
  close(): void;
}

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function makeAcceptKey(clientKey: string): string {
  return crypto
    .createHash('sha1')
    .update(clientKey + WS_MAGIC)
    .digest('base64');
}

// --- Frame writer (server→client, unmasked) ---

function encodeFrame(payload: string): Buffer {
  const data = Buffer.from(payload, 'utf8');
  const len = data.length;
  let header: Buffer;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    // Write 8-byte big-endian length (upper 4 bytes are 0 for sane payloads)
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }

  return Buffer.concat([header, data]);
}

function encodeCloseFrame(): Buffer {
  const frame = Buffer.alloc(2);
  frame[0] = 0x88; // FIN + close opcode
  frame[1] = 0x00;
  return frame;
}

// --- Frame parser (client→server, always masked per RFC 6455) ---

interface ParsedFrame {
  opcode: number;
  payload: string;
  consumed: number; // total bytes consumed from buffer
}

function parseFrame(buf: Buffer): ParsedFrame | null {
  if (buf.length < 2) {
    return null;
  }

  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < offset + 2) {
      return null;
    }
    payloadLen = buf.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buf.length < offset + 8) {
      return null;
    }
    const hi = buf.readUInt32BE(offset);
    const lo = buf.readUInt32BE(offset + 4);
    payloadLen = hi * 0x100000000 + lo;
    offset += 8;
  }

  const maskLen = masked ? 4 : 0;
  if (buf.length < offset + maskLen + payloadLen) {
    return null; // incomplete frame
  }

  let maskKey: Buffer | null = null;
  if (masked) {
    maskKey = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  const rawPayload = buf.subarray(offset, offset + payloadLen);
  offset += payloadLen;

  let payload: Buffer;
  if (maskKey) {
    payload = Buffer.allocUnsafe(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = rawPayload[i] ^ maskKey[i % 4];
    }
  } else {
    payload = rawPayload;
  }

  return { opcode, payload: payload.toString('utf8'), consumed: offset };
}

// --- JSON-RPC helpers ---

function jsonRpcResult(id: number | string, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(
  id: number | string,
  code: number,
  message: string
): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

// --- Tool: openPlan ---

async function handleOpenPlan(filePath: string): Promise<string> {
  await vscode.commands.executeCommand(
    'markdown.showPreviewToSide',
    vscode.Uri.file(filePath)
  );
  return 'Plan opened in VS Code preview.';
}

// --- MCP message dispatcher ---

async function handleMessage(
  raw: string,
  send: (frame: Buffer) => void
): Promise<void> {
  let msg: {
    jsonrpc: string;
    id?: number | string;
    method?: string;
    params?: unknown;
  };

  try {
    msg = JSON.parse(raw);
  } catch {
    // Malformed JSON — ignore (no id to reply to)
    return;
  }

  const { id, method, params } = msg;

  // Notifications (no id) — no response needed
  if (id === undefined || id === null) {
    return;
  }

  if (method === 'initialize') {
    send(
      encodeFrame(
        jsonRpcResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'vscode-mcp', version: '0.0.1' },
        })
      )
    );
    return;
  }

  if (method === 'tools/list') {
    send(
      encodeFrame(
        jsonRpcResult(id, {
          tools: [
            {
              name: 'openPlan',
              description:
                'Opens a markdown plan file in VS Code as a preview panel.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: {
                    type: 'string',
                    description:
                      'Absolute path to the markdown plan file to open.',
                  },
                },
                required: ['filePath'],
              },
            },
          ],
        })
      )
    );
    return;
  }

  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: { filePath?: string } };
    if (p?.name !== 'openPlan') {
      send(
        encodeFrame(
          jsonRpcResult(id, {
            content: [{ type: 'text', text: 'Error: unknown tool' }],
            isError: true,
          })
        )
      );
      return;
    }

    const filePath = p?.arguments?.filePath;
    if (!filePath) {
      send(
        encodeFrame(
          jsonRpcResult(id, {
            content: [{ type: 'text', text: 'Error: missing filePath argument' }],
            isError: true,
          })
        )
      );
      return;
    }

    try {
      const text = await handleOpenPlan(filePath);
      send(
        encodeFrame(
          jsonRpcResult(id, {
            content: [{ type: 'text', text }],
            isError: false,
          })
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      send(
        encodeFrame(
          jsonRpcResult(id, {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          })
        )
      );
    }
    return;
  }

  // Unknown method
  send(encodeFrame(jsonRpcError(id, -32601, 'Method not found')));
}

// --- Server factory ---

export function startMcpServer(
  port: number,
  authToken: string
): Promise<McpServer> {
  return new Promise((resolve, reject) => {
    const sockets = new Set<net.Socket>();
    const buffers = new Map<net.Socket, Buffer>();

    const server = http.createServer();

    server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket) => {
      // --- Authentication ---
      const authHeader = req.headers['authorization'] ?? '';
      const expected = `Bearer ${authToken}`;
      if (authHeader !== expected) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // --- WebSocket handshake ---
      const clientKey = req.headers['sec-websocket-key'];
      if (!clientKey || typeof clientKey !== 'string') {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      const acceptKey = makeAcceptKey(clientKey);
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
          '\r\n'
      );

      // --- Track socket ---
      sockets.add(socket);
      buffers.set(socket, Buffer.alloc(0));

      const cleanup = (): void => {
        sockets.delete(socket);
        buffers.delete(socket);
      };

      socket.on('close', cleanup);
      socket.on('error', cleanup);

      // --- Frame parser ---
      const send = (frame: Buffer): void => {
        if (!socket.destroyed) {
          socket.write(frame);
        }
      };

      socket.on('data', (chunk: Buffer) => {
        let buf = Buffer.concat([buffers.get(socket) ?? Buffer.alloc(0), chunk]);

        while (true) {
          const frame = parseFrame(buf);
          if (!frame) {
            break; // wait for more data
          }

          buf = buf.subarray(frame.consumed);

          if (frame.opcode === 0x8) {
            // Close frame — echo close and destroy
            send(encodeCloseFrame());
            socket.destroy();
            break;
          }

          if (frame.opcode === 0x1) {
            // Text frame
            handleMessage(frame.payload, send).catch(() => {
              /* swallow async errors */
            });
          }
          // Ignore other opcodes (ping, binary, continuation)
        }

        buffers.set(socket, buf);
      });
    });

    server.once('error', reject);

    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);

      const mcpServer: McpServer = {
        port,
        authToken,
        close(): void {
          for (const s of sockets) {
            s.destroy();
          }
          sockets.clear();
          buffers.clear();
          server.close();
        },
      };

      resolve(mcpServer);
    });
  });
}
