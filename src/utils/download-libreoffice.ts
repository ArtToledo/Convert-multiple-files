import { createWriteStream, unlinkSync } from 'fs';
import * as util from 'util';
import * as stream from 'stream';
import * as tar from 'tar';
import * as path from 'path';
import axios from 'axios';

const finished = util.promisify(stream.finished);
const libreOfficeDownloadPath = createWriteStream('./src/lo.tar.gz');

const identifySystemOS = async (): Promise<string> => {
  return process.platform;
}

const downloadLibreOffice = async (typeSystemOS: string) => {
  if (typeSystemOS === 'win32') {
    /* WINDOWS PROCESS */
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
      file: path.join('./src/lo.tar.gz'),
      C: path.join('./src/')
    }
  )
  unlinkSync(path.resolve(__dirname, 'lo.tar.gz'))
}

async function run() {
  const system = await identifySystemOS();
  await downloadLibreOffice(system);
}

run();