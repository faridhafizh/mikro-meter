import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { getBackupDirectory, RouterConfig } from './dataStore';

function getSSHConfig(router: RouterConfig): ConnectConfig {
  return {
    host: router.host,
    port: router.port || 22,
    username: router.username,
    password: router.password || '',
    readyTimeout: 10000,
  };
}

export function testSSHConnection(router: RouterConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.end();
      resolve(true);
    }).on('error', (err) => {
      console.error(`SSH Connection Error for ${router.name} (${router.host}):`, err.message);
      resolve(false);
    }).connect(getSSHConfig(router));
  });
}

export function runSSHCommand(router: RouterConfig, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer | string) => {
          stdout += data.toString();
        });
        stream.stderr.on('data', (data: Buffer | string) => {
          stderr += data.toString();
        });
        stream.on('close', (code: number | null) => {
          conn.end();
          if (code !== 0 && stderr) {
            reject(new Error(`Command failed with code ${code}: ${stderr.trim()}`));
          } else {
            resolve(stdout);
          }
        });
      });
    }).on('error', (err: Error) => {
      reject(err);
    }).connect(getSSHConfig(router));
  });
}

export function downloadSFTPFile(
  router: RouterConfig,
  remotePath: string,
  localPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        sftp.fastGet(remotePath, localPath, {}, (err) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          // Get downloaded file size
          sftp.stat(remotePath, (err, stats) => {
            conn.end();
            if (err) {
              // Fallback to local file size
              try {
                const localStats = fs.statSync(localPath);
                resolve(localStats.size);
              } catch {
                resolve(0);
              }
            } else {
              resolve(stats.size);
            }
          });
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect(getSSHConfig(router));
  });
}

/**
 * Creates a binary backup on the MikroTik router, downloads it to local storage, and deletes the remote temporary file.
 */
export async function performBinaryBackup(router: RouterConfig, filename: string): Promise<number> {
  const remoteFilename = `${filename}.backup`;
  const localPath = path.join(getBackupDirectory(), remoteFilename);

  // Command to create backup on RouterOS
  // "/system backup save name=filename" -> creates filename.backup
  const saveCmd = `/system backup save name=${filename}`;
  await runSSHCommand(router, saveCmd);

  try {
    // Wait a brief second to let the file register, then download
    const size = await downloadSFTPFile(router, remoteFilename, localPath);

    // Delete remote file to conserve router space
    const removeCmd = `/file remove [find name="${remoteFilename}"]`;
    await runSSHCommand(router, removeCmd).catch((err) => 
      console.warn(`Failed to clean up remote backup file: ${err.message}`)
    );

    return size;
  } catch (err) {
    // Try to clean up remote file even if download failed
    const removeCmd = `/file remove [find name="${remoteFilename}"]`;
    await runSSHCommand(router, removeCmd).catch(() => {});
    throw err;
  }
}

/**
 * Exports router config to plain text script (.rsc), downloads it, and deletes the remote temporary file.
 */
export async function performConfigurationExport(router: RouterConfig, filename: string): Promise<number> {
  const remoteFilename = `${filename}.rsc`;
  const localPath = path.join(getBackupDirectory(), remoteFilename);

  // "/export file=filename" -> creates filename.rsc
  const exportCmd = `/export file=${filename}`;
  await runSSHCommand(router, exportCmd);

  try {
    // Download
    const size = await downloadSFTPFile(router, remoteFilename, localPath);

    // Delete remote file
    const removeCmd = `/file remove [find name="${remoteFilename}"]`;
    await runSSHCommand(router, removeCmd).catch((err) => 
      console.warn(`Failed to clean up remote export file: ${err.message}`)
    );

    return size;
  } catch (err) {
    const removeCmd = `/file remove [find name="${remoteFilename}"]`;
    await runSSHCommand(router, removeCmd).catch(() => {});
    throw err;
  }
}
