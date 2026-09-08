import * as fs from 'node:fs';
import * as path from 'node:path';
import * as mammoth from 'mammoth';
import type { ConvertOptions } from './utils/libreoffice';
import { runConversion } from './utils/libreoffice';

export type { ConvertOptions } from './utils/libreoffice';
export { DEFAULT_TIMEOUT_MS } from './utils/libreoffice';

/** Extensions LibreOffice conversion accepts as input. */
const INPUT_FORMATS = /\.(doc|docx|pdf|odt)$/i;
/** Extensions LibreOffice conversion accepts as output. Anchored: 'xdoc' is not valid. */
const OUTPUT_FORMATS = /^(doc|docx|pdf|odt)$/i;

export interface HtmlConversionResult {
  output: string;
}

const assertOutputFormat = (extOutput: string): void => {
  if (!OUTPUT_FORMATS.test(extOutput)) {
    throw new Error('Format to be converted not accepted');
  }
};

const assertInputFormat = (pathFile: string): void => {
  if (!INPUT_FORMATS.test(path.basename(pathFile))) {
    throw new Error('Invalid file format, see the documentation for more information.');
  }
};

const expectedOutputPath = (pathFile: string, extOutput: string, outputDir: string): string =>
  path.join(outputDir, `${path.basename(pathFile, path.extname(pathFile))}.${extOutput}`);

/**
 * Converts a single document via the bundled LibreOffice.
 *
 * Returns the path of the converted file, which is verified to exist before
 * being returned.
 */
export const convertWordFiles = async (
  pathFile: string,
  extOutput: string,
  outputDir: string,
  options: ConvertOptions = {},
): Promise<string> => {
  assertInputFormat(pathFile);
  assertOutputFormat(extOutput);

  try {
    await runConversion([pathFile], extOutput, outputDir, options);
  } catch (e) {
    throw new Error('Error converting the file', { cause: e });
  }

  const outputPath = expectedOutputPath(pathFile, extOutput, outputDir);
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Error converting the file: LibreOffice did not produce ${outputPath}`);
  }

  return outputPath;
};

/**
 * Converts several documents in ONE LibreOffice invocation.
 *
 * LibreOffice startup dominates conversion time, so this is dramatically faster
 * than calling convertWordFiles in a loop.
 */
export const convertWordFilesBatch = async (
  pathFiles: string[],
  extOutput: string,
  outputDir: string,
  options: ConvertOptions = {},
): Promise<string[]> => {
  if (!Array.isArray(pathFiles) || pathFiles.length === 0) {
    throw new Error('No files provided for conversion');
  }
  pathFiles.forEach(assertInputFormat);
  assertOutputFormat(extOutput);

  try {
    await runConversion(pathFiles, extOutput, outputDir, options);
  } catch (e) {
    throw new Error('Error converting the file', { cause: e });
  }

  const outputPaths = pathFiles.map((pathFile) => expectedOutputPath(pathFile, extOutput, outputDir));
  const missing = outputPaths.filter((outputPath) => !fs.existsSync(outputPath));
  if (missing.length > 0) {
    throw new Error(`Error converting the file: LibreOffice did not produce ${missing.join(', ')}`);
  }

  return outputPaths;
};

/**
 * Centers the leading paragraph, which this library treats as the document title.
 * Exported for testing; the behaviour predates 2.0.0 and is kept as-is.
 */
export const applyTitleAlignment = (contentHTML: string): string => {
  if (!contentHTML.startsWith('<p>')) return contentHTML;

  const titleTags = contentHTML.substring(0, contentHTML.indexOf('</p>') + 4);
  const alignTitle = titleTags.replace(/<p>/g, '<center>').replace(/<\/p>/g, '</center>');

  return contentHTML.replace(titleTags, alignTitle);
};

/**
 * Converts a .docx to HTML via mammoth. Resolves undefined when the document
 * produces no content, in which case no file is written.
 */
export const convertWordFileToHTML = async (
  pathFile: string,
  outputDir: string,
  outputPrefix: string,
): Promise<HtmlConversionResult | undefined> => {
  try {
    const { value: contentHTML } = await mammoth.convertToHtml({ path: pathFile });
    if (!contentHTML) return undefined;

    const outputPath = path.resolve(outputDir, `${outputPrefix}.html`);
    await fs.promises.writeFile(outputPath, applyTitleAlignment(contentHTML));

    return { output: outputPath };
  } catch (e) {
    throw new Error('Error converting the file to HTML', { cause: e });
  }
};

/** Reads any file and returns its base64 representation. */
export const convertToBase64 = async (pathFile: string): Promise<string> => {
  const data = await fs.promises.readFile(pathFile);

  return data.toString('base64');
};
