#!/usr/bin/env node

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as stream from 'node:stream';
import * as util from 'node:util';
import axios from 'axios';
import * as tar from 'tar';

const pipeline = util.promisify(stream.pipeline);

interface Release {
  url: string;
  /**
   * Expected SHA-256 of the archive. When null the download is not verified;
   * populate it (`sha256sum lo.tar.gz`) to harden the install.
   */
  sha256: string | null;
}

const RELEASES: Partial<Record<NodeJS.Platform, Release>> = {
  linux: {
    url: 'https://github.com/vladgolubev/serverless-libreoffice/releases/download/v6.1.0.0.alpha0/lo.tar.gz',
    sha256: null,
  },
  win32: {
    url: 'https://github.com/ArtToledo/Convert-multiple-files/releases/download/1.0.0/libreoffice.tar.gz',
    sha256: null,
  },
};

const sha256 = async (file: string): Promise<string> => {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);

  return hash.digest('hex');
};

const download = async (url: string, destination: string): Promise<void> => {
  const response = await axios.get<stream.Readable>(url, { responseType: 'stream' });
  await pipeline(response.data, fs.createWriteStream(destination));
};

const run = async (): Promise<void> => {
  const platform = process.platform;
  const release = RELEASES[platform];

  if (!release) {
    // Not fatal: convertToBase64 and convertWordFileToHTML do not need LibreOffice.
    console.warn(
      `convert-multiple-files: no LibreOffice bundle for platform '${platform}'. ` +
        'Document conversion will be unavailable; base64 and DOCX-to-HTML still work.',
    );
    return;
  }

  const archivePath = path.join(__dirname, 'lo.tar.gz');

  try {
    await download(release.url, archivePath);

    if (release.sha256) {
      const actual = await sha256(archivePath);
      if (actual !== release.sha256) {
        throw new Error(`Checksum mismatch for ${release.url}: expected ${release.sha256}, got ${actual}`);
      }
    }

    await tar.extract({ file: archivePath, cwd: __dirname });
  } finally {
    await fs.promises.rm(archivePath, { force: true });
  }
};

run().catch((error: unknown) => {
  console.error('convert-multiple-files: failed to install LibreOffice.', error);
  process.exit(1);
});
