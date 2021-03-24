#!/usr/bin/env node

import { createWriteStream, unlinkSync } from 'fs';
import * as util from 'util';
import * as stream from 'stream';
import * as tar from 'tar';
import * as path from 'path';
import axios from 'axios';

const finished = util.promisify(stream.finished);
const libreOfficeDownloadPath = createWriteStream(path.join(__dirname, 'lo.tar.gz'));

const identifySystemOS = async (): Promise<string> => {
  return process.platform;
}

const downloadLibreOffice = async (typeSystemOS: string) => {
  if (typeSystemOS === 'win32') {
    writeArchiveDownloadWindows().catch(err => { 
      throw new Error(err) 
    });
  }

  if (typeSystemOS === 'linux') {
    writeArchiveDownload().catch(err => { 
      throw new Error(err) 
    });
  }
}

async function writeArchiveDownload() {
  const response = await axios.get('https://github.com/vladgolubev/serverless-libreoffice/releases/download/v6.1.0.0.alpha0/lo.tar.gz', {responseType: "stream"});
  await finished(response.data.pipe(libreOfficeDownloadPath));
  await tar.extract(
    {
      file: path.join(__dirname, 'lo.tar.gz'),
      C: path.join(__dirname)
    }
  )
  unlinkSync(path.resolve(__dirname, 'lo.tar.gz'))
}

async function writeArchiveDownloadWindows() {
  const response = await axios.get('https://github.com/ArtToledo/Convert-multiple-files/releases/download/1.0.0/libreoffice.tar.gz', {responseType: "stream"});
  await finished(response.data.pipe(libreOfficeDownloadPath));
  await tar.extract(
    {
      file: path.join(__dirname, 'lo.tar.gz'),
      C: path.join(__dirname)
    }
  )
  unlinkSync(path.resolve(__dirname, 'lo.tar.gz'))
}

async function run() {
  const system = await identifySystemOS();
  await downloadLibreOffice(system);
}

run();