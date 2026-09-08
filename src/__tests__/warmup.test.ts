import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Loads a pristine copy of the module so the warm-up memo starts empty.
 * resetModules also rebuilds the child_process mock, so the fresh mock has to be
 * picked up from the same registry generation as the module under test.
 */
const freshModule = () => {
  jest.resetModules();
  const execFileMock = require('node:child_process').execFile as jest.Mock;
  execFileMock.mockReset();
  execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''));

  return { lo: require('../utils/libreoffice'), execFileMock };
};

/** Each test gets its own template path so parallel test files never collide. */
beforeEach(() => {
  process.env.CMF_LO_PROFILE_DIR = path.join(os.tmpdir(), `cmf-tpl-wu-${Math.random().toString(36).slice(2)}`);
});

const templateDir = (): string => process.env.CMF_LO_PROFILE_DIR!;

const profileDirOf = (args: string[]): string =>
  fileURLToPath(args.find((arg) => arg.startsWith('-env:UserInstallation='))!.replace('-env:UserInstallation=', ''));

describe('profile template warm-up', () => {
  it('burns one throwaway run to initialise the template, then reuses it', async () => {
    const { lo, execFileMock } = freshModule();
    fs.rmSync(templateDir(), { recursive: true, force: true });

    await lo.runConversion(['/tmp/a.docx'], 'pdf', '/out');

    // Call 0 is the warm-up, call 1 the real conversion.
    expect(execFileMock).toHaveBeenCalledTimes(2);
    const warmupArgs = execFileMock.mock.calls[0][1] as string[];
    expect(warmupArgs[warmupArgs.length - 1]).toMatch(/warmup-absent\.docx$/);
    expect(fs.existsSync(path.join(templateDir(), '.cmf-warm'))).toBe(true);

    // The template is warm now, so nothing further is burned.
    execFileMock.mockClear();
    await lo.runConversion(['/tmp/b.docx'], 'pdf', '/out');
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('treats a failing warm-up run as success, because LibreOffice always fails it', async () => {
    const { lo, execFileMock } = freshModule();
    fs.rmSync(templateDir(), { recursive: true, force: true });

    let call = 0;
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      // The real binary exits 81 on a brand-new profile; only the warm-up sees it.
      callback(call++ === 0 ? new Error('exit 81') : null, '', '');
    });

    await expect(lo.runConversion(['/tmp/a.docx'], 'pdf', '/out')).resolves.toBeUndefined();
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('gives each conversion its own profile copied from the template', async () => {
    const { lo, execFileMock } = freshModule();
    fs.mkdirSync(templateDir(), { recursive: true });
    fs.writeFileSync(path.join(templateDir(), '.cmf-warm'), '');
    fs.writeFileSync(path.join(templateDir(), 'registrymodifications.xcu'), '<seed/>');

    let seedWasCopied = false;
    execFileMock.mockImplementation((_file, args: string[], _options, callback) => {
      seedWasCopied = fs.existsSync(path.join(profileDirOf(args), 'registrymodifications.xcu'));
      callback(null, '', '');
    });

    await lo.runConversion(['/tmp/a.docx'], 'pdf', '/out');

    expect(seedWasCopied).toBe(true);
  });
});
