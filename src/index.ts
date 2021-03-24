import * as path from 'path';
import * as child_process from 'child_process';
import * as mammoth from 'mammoth-style';
import * as fs from 'fs';
import * as Canvas from 'canvas';
const assert = require("assert").strict
const pdfjsLib = require('pdfjs-dist/es5/build/pdf.js')

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

export const convertPDFtoImage = async (pathFile: string, outputDir: string, nameOutput: string, numberPage: number) => {
  function NodeCanvasFactory() { }
  NodeCanvasFactory.prototype = {
    create: function NodeCanvasFactory_create(width, height) {
      assert(width > 0 && height > 0, "Invalid canvas size");
      const canvas = Canvas.createCanvas(width, height);
      const context = canvas.getContext("2d");
      return {
        canvas,
        context,
      };
    },

  reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    assert(width > 0 && height > 0, "Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, "Canvas is not specified");

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
  };

  // Some PDFs need external cmaps.
  const CMAP_URL = "../node_modules/pdfjs-dist/cmaps/";
  const CMAP_PACKED = true;

  // Loading file from file system into typed array.
  const pdfPath = pathFile;
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  // Load the PDF file.
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
  });
  loadingTask.promise
    .then(function (pdfDocument) {

    const numberOfPages = pdfDocument._numPages;

    pdfDocument.getPage(numberPage).then(function (page) {
      // Render the page on a Node canvas with 100% scale.
      const viewport = page.getViewport({ scale: 1.0 });
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(
        viewport.width,
        viewport.height
      );
      const renderContext = {
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(function () {
        // Convert the canvas to an image buffer.
        const image = canvasAndContext.canvas.toBuffer();
        fs.writeFile(path.resolve(outputDir, `${nameOutput}-${numberPage}.png`), image, function (error) {
          if (error) {
            throw new Error(error.message)
          }
        });
      });
    });
  })
  .catch(function (reason) {
    throw new Error(reason)
  });
}

export const numberOfPagesFromPDF = async (pathFile: string) => {
  function NodeCanvasFactory() { }
  NodeCanvasFactory.prototype = {
    create: function NodeCanvasFactory_create(width, height) {
      assert(width > 0 && height > 0, "Invalid canvas size");
      const canvas = Canvas.createCanvas(width, height);
      const context = canvas.getContext("2d");
      return {
        canvas,
        context,
      };
    },

  reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    assert(width > 0 && height > 0, "Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, "Canvas is not specified");

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
  };

  // Some PDFs need external cmaps.
  const CMAP_URL = "../node_modules/pdfjs-dist/cmaps/";
  const CMAP_PACKED = true;

  // Loading file from file system into typed array.
  const pdfPath = pathFile;
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  // Load the PDF file.
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
  });
  let pdf = await loadingTask.promise
  return pdf._pdfInfo.numPages
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