import * as path from 'path';
import * as child_process from 'child_process';
import * as pdf from 'pdf-poppler';
import * as mammoth from 'mammoth-style';
import * as fs from 'fs';

export const convertWordFiles = async (pathFile: string, extOutput: string, outputDir: string): Promise<string> => {
  const system = process.platform;
  const extension = path.extname(pathFile);
  const fileName = path.basename(pathFile, extension);
  const fullName = path.basename(pathFile);
  const convertCommandLinux = `${path.resolve(__dirname, 'utils', 'instdir', 'program', 'soffice.bin')} --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to ${extOutput} --outdir ${outputDir} ${pathFile}`;
  const convertCommandWindows = `${path.resolve(__dirname, 'utils', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.bin')} --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to ${extOutput} --outdir ${outputDir} ${pathFile}`;

  if (!fullName.match(/\.(doc|docx|pdf|odt)$/)) {
    throw new Error('Invalid file format, see the documentation for more information.');
  } else if (!extOutput.match(/(doc|docx|pdf|odt)$/)) {
    throw new Error('Format to be converted not accepted');
  }

  try {
    if (system === 'linux') { child_process.execSync(convertCommandLinux).toString('utf8') }
    if (system === 'win32') { child_process.execSync(convertCommandWindows).toString('utf8') }
  } catch (e) {
    throw new Error('Error converting the file');
  }

  return path.join(outputDir, `${fileName}.${extOutput}`);
}

export const convertPDFtoImage = async (pathFile: string, convertTo: string, outputDir: string, outputPrefix: string, page: number | null = null) => {
  try {
    const { pages } = await pdf.info(pathFile);
    await pdf.convert(pathFile, {
      format: convertTo,
      out_dir: outputDir,
      out_prefix: outputPrefix,
      page
    });

    return { numberOfPages: pages, message: 'Successfully transformed file' }
  } catch (e) {
    throw new Error(`Error converting the file to ${convertTo}`);
  }
}

export const convertWordFileToHTML = async (pathFile: string, outputDir: string, outputPrefix: string) => {
  try {
    const { value: contentHTML } = await mammoth.convertToHtml({ path: pathFile });
    fs.writeFileSync(path.resolve(outputDir, `${outputPrefix}.html`), contentHTML);

    return {
      output: `${path.resolve(outputDir, `${outputPrefix}.html`)}`
    }
  } catch (e) {
    throw new Error('Error converting the file to HTML');
  }
}

export const convertToBase64 = async (pathFile: string): Promise<string> => {
  const data = fs.readFileSync(pathFile);
  const dataBase64 = Buffer.from(data).toString('base64');

  return dataBase64
}