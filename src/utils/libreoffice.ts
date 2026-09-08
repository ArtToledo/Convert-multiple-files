import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Default ceiling for a single LibreOffice invocation. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Shared, pre-initialised LibreOffice profile that per-run profiles are cloned
 * from. Override with CMF_LO_PROFILE_DIR when the temp dir is not writable.
 */
export const profileTemplateDir = (): string =>
  process.env.CMF_LO_PROFILE_DIR ?? path.join(os.tmpdir(), 'cmf-lo-profile');

const WARM_MARKER = '.cmf-warm';

export interface ConvertOptions {
  /** Milliseconds before the LibreOffice process is killed. Defaults to 60000. */
  timeout?: number;
}

/**
 * Locates the bundled soffice binary. The layout is created by the postinstall
 * download script, which extracts into this same directory (lib/utils).
 */
export const resolveSofficeBin = (platform: NodeJS.Platform = process.platform): string => {
  if (platform === 'linux') {
    return path.resolve(__dirname, 'instdir', 'program', 'soffice.bin');
  }
  if (platform === 'win32') {
    return path.resolve(__dirname, 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.bin');
  }
  throw new Error(
    `Unsupported platform '${platform}': convert-multiple-files bundles LibreOffice for linux and win32 only.`,
  );
};

/** Promise wrapper over execFile. Arguments are passed as an array, so no shell is involved. */
const execFileAsync = (file: string, args: string[], timeout: number): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const copyDir = async (src: string, dest: string): Promise<void> => {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) await copyDir(from, to);
      else if (entry.isFile()) await fs.promises.copyFile(from, to);
    }),
  );
};

/**
 * LibreOffice initialises a brand-new UserInstallation on its first run and
 * silently drops whatever conversion it was asked for, exiting non-zero. Burn
 * that run once here, against a deliberately absent input, so real conversions
 * never pay for it. Verified: a fresh profile fails every time, a warmed one
 * succeeds every time, and a *copy* of a warmed profile works.
 */
const warmTemplate = async (soffice: string): Promise<string> => {
  const templateDir = profileTemplateDir();
  if (fs.existsSync(path.join(templateDir, WARM_MARKER))) return templateDir;

  await fs.promises.mkdir(templateDir, { recursive: true });
  await execFileAsync(
    soffice,
    [
      `-env:UserInstallation=${pathToFileURL(templateDir).href}`,
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      templateDir,
      path.join(templateDir, 'warmup-absent.docx'),
    ],
    DEFAULT_TIMEOUT_MS,
  ).catch(() => undefined);

  await fs.promises.writeFile(path.join(templateDir, WARM_MARKER), '');

  return templateDir;
};

let warming: Promise<string> | null = null;

/** Memoised so concurrent first calls warm the template exactly once. */
const ensureTemplate = (soffice: string): Promise<string> => {
  if (!warming) {
    warming = warmTemplate(soffice).catch((error: unknown) => {
      warming = null;
      throw error;
    });
  }

  return warming;
};

/**
 * Converts one or more files in a single LibreOffice invocation.
 *
 * Each call gets a private UserInstallation profile cloned from the warmed
 * template: without isolation, concurrent soffice processes fight over a shared
 * profile and hang or fail.
 */
export const runConversion = async (
  inputs: string[],
  extOutput: string,
  outputDir: string,
  options: ConvertOptions = {},
): Promise<void> => {
  const soffice = resolveSofficeBin();
  const template = await ensureTemplate(soffice);
  const profileDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cmf-run-'));

  try {
    await copyDir(template, profileDir);
    await execFileAsync(
      soffice,
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--norestore',
        '--invisible',
        '--nodefault',
        '--nofirststartwizard',
        '--nolockcheck',
        '--nologo',
        '--convert-to',
        extOutput,
        '--outdir',
        outputDir,
        ...inputs,
      ],
      options.timeout ?? DEFAULT_TIMEOUT_MS,
    );
  } finally {
    await fs.promises.rm(profileDir, { recursive: true, force: true });
  }
};
