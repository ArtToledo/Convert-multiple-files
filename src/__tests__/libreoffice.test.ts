import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_TIMEOUT_MS, resolveSofficeBin, runConversion } from '../utils/libreoffice';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

const execFileMock = execFile as unknown as jest.Mock;

/** Captures the arguments of the last execFile call. */
const lastCall = () => ({
  file: execFileMock.mock.calls[0][0] as string,
  args: execFileMock.mock.calls[0][1] as string[],
  options: execFileMock.mock.calls[0][2] as { timeout: number },
});

// Pretend the shared profile template is already warmed, so the warm-up run does
// not show up in the execFile call counts asserted below.
beforeAll(() => {
  // A private, already-warm template: the shared default path races other test files.
  process.env.CMF_LO_PROFILE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-tpl-lo-'));
  fs.writeFileSync(path.join(process.env.CMF_LO_PROFILE_DIR, '.cmf-warm'), '');
});

beforeEach(() => {
  execFileMock.mockReset();
  // Default: report success to the node-style callback.
  execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''));
});

describe('resolveSofficeBin', () => {
  it('points at the extracted bundle on linux', () => {
    expect(resolveSofficeBin('linux')).toBe(
      path.resolve(__dirname, '..', 'utils', 'instdir', 'program', 'soffice.bin'),
    );
  });

  it('points at the portable bundle on win32', () => {
    expect(resolveSofficeBin('win32')).toBe(
      path.resolve(__dirname, '..', 'utils', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.bin'),
    );
  });

  it('fails loudly on an unsupported platform instead of silently doing nothing', () => {
    expect(() => resolveSofficeBin('darwin')).toThrow(/Unsupported platform 'darwin'/);
  });
});

describe('runConversion', () => {
  it('passes arguments as an array so no shell can interpret them', async () => {
    await runConversion(['/tmp/a file.docx'], 'pdf', '/out');

    const { file, args } = lastCall();
    expect(file).toMatch(/soffice\.bin$/);
    // The whole point: the path stays one argv entry, quoting is never needed.
    expect(args).toContain('/tmp/a file.docx');
    expect(args).toEqual(expect.arrayContaining(['--convert-to', 'pdf', '--outdir', '/out']));
    // Nothing is concatenated into a command string.
    expect(args.some((arg) => arg.includes('&&') || arg.includes(';'))).toBe(false);
  });

  it('does not let a crafted output format inject extra arguments', async () => {
    await runConversion(['/tmp/a.docx'], 'pdf; rm -rf /', '/out');

    const { args } = lastCall();
    // The payload survives verbatim as a single argv entry rather than becoming a second command.
    expect(args[args.indexOf('--convert-to') + 1]).toBe('pdf; rm -rf /');
  });

  it('isolates the LibreOffice profile per invocation so concurrent calls do not collide', async () => {
    await runConversion(['/tmp/a.docx'], 'pdf', '/out');
    const first = lastCall().args.find((arg) => arg.startsWith('-env:UserInstallation='));

    execFileMock.mockClear();
    await runConversion(['/tmp/b.docx'], 'pdf', '/out');
    const second = lastCall().args.find((arg) => arg.startsWith('-env:UserInstallation='));

    expect(first).toMatch(/^-env:UserInstallation=file:\/\//);
    expect(second).toMatch(/^-env:UserInstallation=file:\/\//);
    expect(first).not.toBe(second);
  });

  it('removes the temporary profile directory afterwards', async () => {
    await runConversion(['/tmp/a.docx'], 'pdf', '/out');

    const profileArg = lastCall().args.find((arg) => arg.startsWith('-env:UserInstallation='))!;
    const profileDir = profileArg.replace('-env:UserInstallation=', '');
    expect(fs.existsSync(new URL(profileDir))).toBe(false);
  });

  it('cleans up the profile directory even when the conversion fails', async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(new Error('boom'), '', ''));

    await expect(runConversion(['/tmp/a.docx'], 'pdf', '/out')).rejects.toThrow('boom');

    // Assert on this call's own directory: a tmpdir-wide scan races other test files.
    const profileArg = lastCall().args.find((arg) => arg.startsWith('-env:UserInstallation='))!;
    expect(fs.existsSync(new URL(profileArg.replace('-env:UserInstallation=', '')))).toBe(false);
  });

  it('converts every input in a single invocation', async () => {
    await runConversion(['/tmp/a.docx', '/tmp/b.docx', '/tmp/c.docx'], 'pdf', '/out');

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const { args } = lastCall();
    expect(args.slice(-3)).toEqual(['/tmp/a.docx', '/tmp/b.docx', '/tmp/c.docx']);
  });

  it('applies a default timeout and honours an override', async () => {
    await runConversion(['/tmp/a.docx'], 'pdf', '/out');
    expect(lastCall().options.timeout).toBe(DEFAULT_TIMEOUT_MS);

    execFileMock.mockClear();
    await runConversion(['/tmp/a.docx'], 'pdf', '/out', { timeout: 1234 });
    expect(lastCall().options.timeout).toBe(1234);
  });
});
