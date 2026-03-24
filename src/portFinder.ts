import * as net from 'net';
import { logger } from './logger';

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(err => {
        if (err) {
          reject(err);
        } else {
          logger.debug(`portFinder: found free port ${port}`);
          resolve(port);
        }
      });
    });
    srv.on('error', (err) => {
      srv.close(() => reject(err));
    });
  });
}
