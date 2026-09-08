import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyTitleAlignment, convertToBase64, convertWordFiles, convertWordFilesBatch } from '../index';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

const execFileMock = execFile as unknown as jest.Mock;

let workDir: string;

/** Makes the mocked LibreOffice "produce" the files it was asked to convert. */
const succeedProducing = (...outputs: string[]) => {
  execFileMock.mockImplementation((_file, _args, _options, callback) => {
    outputs.forEach((output) => fs.writeFileSync(output, 'converted'));
    callback(null, '', '');
  });
};

// The shared profile template is pre-warmed so the warm-up run never appears in
// the execFile call counts asserted here.
beforeAll(() => {
  // A private, already-warm template: the shared default path races other test files.
  process.env.CMF_LO_PROFILE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-tpl-cv-'));
  fs.writeFileSync(path.join(process.env.CMF_LO_PROFILE_DIR, '.cmf-warm'), '');
});

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-test-'));
  execFileMock.mockReset();
  execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('convertWordFiles', () => {
  it('rejects an unsupported input extension before spawning anything', async () => {
    await expect(convertWordFiles('/tmp/file.txt', 'pdf', workDir)).rejects.toThrow(
      'Invalid file format, see the documentation for more information.',
    );
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('rejects an unsupported output extension', async () => {
    await expect(convertWordFiles('/tmp/file.docx', 'exe', workDir)).rejects.toThrow(
      'Format to be converted not accepted',
    );
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('rejects a format that merely ends with a valid one (regression: unanchored regex)', async () => {
    await expect(convertWordFiles('/tmp/file.docx', 'xdoc', workDir)).rejects.toThrow(
      'Format to be converted not accepted',
    );
  });

  it('returns the converted path once the file really exists', async () => {
    const expected = path.join(workDir, 'file.pdf');
    succeedProducing(expected);

    await expect(convertWordFiles('/tmp/file.docx', 'pdf', workDir)).resolves.toBe(expected);
  });

  it('throws instead of returning a path LibreOffice never created', async () => {
    await expect(convertWordFiles('/tmp/file.docx', 'pdf', workDir)).rejects.toThrow(/did not produce/);
  });

  it('wraps the underlying failure as the cause', async () => {
    const underlying = new Error('soffice exploded');
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(underlying, '', ''));

    await expect(convertWordFiles('/tmp/file.docx', 'pdf', workDir)).rejects.toMatchObject({
      message: 'Error converting the file',
      cause: underlying,
    });
  });
});

describe('convertWordFilesBatch', () => {
  it('converts many files with a single LibreOffice startup', async () => {
    const outputs = ['a.pdf', 'b.pdf'].map((name) => path.join(workDir, name));
    succeedProducing(...outputs);

    await expect(convertWordFilesBatch(['/tmp/a.docx', '/tmp/b.docx'], 'pdf', workDir)).resolves.toEqual(outputs);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('reports which outputs are missing', async () => {
    succeedProducing(path.join(workDir, 'a.pdf'));

    await expect(convertWordFilesBatch(['/tmp/a.docx', '/tmp/b.docx'], 'pdf', workDir)).rejects.toThrow(/b\.pdf/);
  });

  it('rejects an empty list', async () => {
    await expect(convertWordFilesBatch([], 'pdf', workDir)).rejects.toThrow('No files provided for conversion');
  });
});

describe('applyTitleAlignment', () => {
  it('centers the leading paragraph', () => {
    expect(applyTitleAlignment('<p>Title</p><p>Body</p>')).toBe('<center>Title</center><p>Body</p>');
  });

  it('leaves content untouched when it does not start with a paragraph', () => {
    const html = '<h1>Title</h1><p>Body</p>';
    expect(applyTitleAlignment(html)).toBe(html);
  });

  it('handles a document with a single paragraph', () => {
    expect(applyTitleAlignment('<p>Only</p>')).toBe('<center>Only</center>');
  });
});

describe('convertToBase64', () => {
  it('encodes file contents', async () => {
    const file = path.join(workDir, 'sample.bin');
    fs.writeFileSync(file, 'hello world');

    await expect(convertToBase64(file)).resolves.toBe(Buffer.from('hello world').toString('base64'));
  });

  it('encodes binary content without corruption', async () => {
    const file = path.join(workDir, 'bytes.bin');
    const bytes = Buffer.from([0x00, 0xff, 0x10, 0x80]);
    fs.writeFileSync(file, bytes);

    await expect(convertToBase64(file)).resolves.toBe(bytes.toString('base64'));
  });

  it('rejects when the file is missing', async () => {
    await expect(convertToBase64(path.join(workDir, 'nope.bin'))).rejects.toThrow();
  });
});
