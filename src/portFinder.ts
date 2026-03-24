import * as net from 'net';

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(err => err ? reject(err) : resolve(port));
    });
    srv.on('error', reject);
  });
}
