import * as path from 'path';
import * as child_process from 'child_process';
import * as mammoth from 'mammoth-style';
import * as fs from 'fs';

export const convertWordFiles = async (pathFile: string, extOutput: string, outputDir: string): Promise<string> => {
  const system = process.platform;
  const extension = path.extname(pathFile);
  const fileName = path.basename(pathFile, extension);
  const fullName = path.basename(pathFile);
  const convertCommandLinux = 'timeout 6s ' + `${path.resolve(__dirname, 'utils', 'instdir', 'program', 'soffice.bin')} --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to ${extOutput} --outdir ${outputDir} '${pathFile}'`;
  const convertCommandWindows = `${path.resolve(__dirname, 'utils', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.bin')} --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to ${extOutput} --outdir ${outputDir} "${pathFile}"`;

  if (!fullName.match(/\.(doc|docx|pdf|odt)$/i)) {
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

export const convertWordFileToHTML = async (pathFile: string, outputDir: string, outputPrefix: string) => {
  try {
    const { value: contentHTML } = await mammoth.convertToHtml({ path: pathFile });
    if (!contentHTML) return;

    if (contentHTML.search('<p>') === 0) {
      const titleTags = contentHTML.substring(0, contentHTML.indexOf('</p>') + 4);
      let alignTitle = titleTags.replace(/<p>/g, '<center>');
      alignTitle = alignTitle.replace(/<\/p>/g, '</center>');
      
      const newContentHTML = contentHTML.replace(titleTags, alignTitle)
      fs.writeFileSync(path.resolve(outputDir, `${outputPrefix}.html`), newContentHTML);
      return {
        output: `${path.resolve(outputDir, `${outputPrefix}.html`)}`
      };
    }
    
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
