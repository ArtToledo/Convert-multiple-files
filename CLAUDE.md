# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`convert-multiple-files` — an npm library (TypeScript, CommonJS) that converts
office documents (doc/docx/odt/pdf) by shelling out to a **bundled portable
LibreOffice**, plus two standalone helpers (docx→HTML via `mammoth`, and any
file→base64).

Public API is the exports in `src/index.ts`; there is no CLI.

## Commands

```bash
npm run build     # tsc -> ./lib (also runs via `prepare` on install/publish)
npm test          # jest --config jestconfig.json
npm run lint      # eslint src (type-aware)
npm run dev       # ts-node-dev on src/index.ts (scratch runner, not a server)
npm run format    # prettier --write "src/**/*.ts"
```

`npm run build` must be run before anything can exercise `postinstall`, since
that hook runs the **compiled** `lib/utils/download-libreoffice.js`. When
installing dependencies for development use `npm install --ignore-scripts`,
otherwise postinstall downloads a LibreOffice bundle (hundreds of MB).

## Architecture

```
src/index.ts                      # public API
src/utils/libreoffice.ts          # binary resolution + the actual soffice invocation
src/utils/download-libreoffice.ts # postinstall script; downloads + untars LibreOffice
src/__tests__/                    # unit tests (child_process is mocked)
```

### The LibreOffice dependency is downloaded, not vendored

`download-libreoffice.ts` runs as `postinstall`, switches on `process.platform`,
and downloads a platform-specific tarball into its own directory (`lib/utils/`):

- **linux** → `vladgolubev/serverless-libreoffice` release → extracts to `instdir/`
- **win32** → this repo's own `1.0.0` release asset → extracts to `LibreOfficePortable/`

`resolveSofficeBin` in `src/utils/libreoffice.ts` builds the path to `soffice.bin`
inside those directories. **The extracted layout and these paths are coupled** — if
you change the download URL, the extraction target, or the `path.resolve(__dirname, ...)`
segments, both sides must change together. Both files live in `src/utils/`, so
`__dirname` is `lib/utils/` at runtime and the two agree by construction.

Any platform other than linux/win32 warns during install (non-fatal — the HTML and
base64 helpers do not need LibreOffice) and throws a clear error if a conversion is
actually attempted.

### Conversion path

`runConversion` spawns `soffice.bin` through `execFile` with an **argument array**:
no shell is involved, so nothing needs quoting and no input can inject arguments.
Two invariants matter:

- **Never rebuild this as a command string.** The pre-2.0 code interpolated
  `extOutput` and `outputDir` straight into a shell command.
- **Every invocation gets a private `-env:UserInstallation` profile dir**, cloned
  from a warmed template and removed in a `finally`. Without isolation,
  concurrent soffice processes fight over the shared default profile and hang.
- **Never point `-env:UserInstallation` at a brand-new directory.** LibreOffice
  initialises a fresh profile on first use and drops the conversion while doing
  so, exiting 81 — measured here as 5 failures out of 5 on a fresh profile
  against 5 successes out of 5 on a warmed one, for every conversion type.
  `warmTemplate` burns exactly one throwaway run (against a deliberately absent
  input) to initialise a shared template, and each conversion clones it (~1.4 MB,
  57 files). A *copy* of a warmed profile works — that was verified, not assumed.
  `--terminate_after_init` is **not** enough: it writes 15 files and the next
  conversion still fails. The template path is overridable via
  `CMF_LO_PROFILE_DIR`, which is also how the test files avoid racing each other
  over one shared path.

`convertWordFiles` verifies the output file exists before returning its path;
`convertWordFilesBatch` converts N files in a single soffice startup, which is the
whole performance story of this library.

`convertWordFileToHTML` has a quirk worth preserving unless asked otherwise: if
mammoth's output starts with `<p>`, that first paragraph is rewritten to
`<center>…</center>` as a document title (`applyTitleAlignment`, exported for tests).
It resolves `undefined` for empty content, writing no file.

## Conventions

- Prettier: 120 cols, single quotes, trailing commas (`.prettierrc`). Run
  `npm run format` rather than hand-formatting.
- ESLint flat config (`eslint.config.mjs`) with type-aware rules. It reads
  `tsconfig.eslint.json`, which exists **only** because the build `tsconfig.json`
  excludes `__tests__` (to keep them out of `lib/`) while type-aware linting still
  needs to see them. Don't merge the two.
- `tsconfig.json`: target **es2022**, `module: node18`, `strict: true`,
  `isolatedModules: true`. Because of `isolatedModules`, type-only re-exports must
  use `export type { … }`.
- `types: ["node", "jest"]` is required explicitly — without it TypeScript does not
  pick up `@types/node` here and every Node builtin import fails.
- `rootDir` is pinned to `./src` so the emitted layout stays exactly
  `lib/index.js` + `lib/utils/*.js`, which `package.json` references by hardcoded
  path (`main`, `postinstall`). Adding a source file outside `src/` would shift the
  common source dir and break both.
- **Never widen `files` back to a bare `lib/**/*`.** The postinstall extracts
  LibreOffice into `lib/utils/`, so the negation patterns in `package.json`
  (`!lib/utils/LibreOfficePortable`, `!lib/utils/instdir`) are the only thing
  keeping a ~225 MB bundle out of the published tarball. Sanity check before any
  publish: `npm pack --dry-run` must report single-digit kB and ~8 files.
- Error messages are load-bearing for compatibility: `'Error converting the file'`,
  `'Format to be converted not accepted'`, and
  `'Invalid file format, see the documentation for more information.'` are
  unchanged since 1.x. Add context via `{ cause }`, not by rewording them.

## Testing

`npm test` runs 28 unit tests with `child_process` mocked, so no LibreOffice
install is needed. They cover format validation, output-path construction and
verification, base64, the HTML title rewrite, and — importantly — the **shape of
the argv passed to soffice**, which is what keeps the shell-injection fix from
regressing.

`testEnvironment` is pinned to `node` (Jest's old default was jsdom) and `roots`
to `src`, which is why the suite runs in well under a second.

There is deliberately no end-to-end conversion test: it would require downloading
LibreOffice. If you add one, gate it behind an env var so the default suite stays
fast and offline.

## Known rough edges

Do not "fix" these unprompted — flag them and ask — but be aware of them:

- **The downloaded archives are not checksum-verified.** `RELEASES` in
  `download-libreoffice.ts` has a `sha256` field wired into the install flow but
  set to `null` for both platforms, so verification is skipped. Populating it
  requires downloading each release and recording its digest.
- `npm audit` reports vulnerabilities in **devDependencies only** (ReDoS in
  jest/ts-jest's own transitive `js-yaml`, `glob`, `picomatch`). Runtime
  dependencies are clean, and `files: ["lib/**/*"]` means dev tooling is never
  published.
- Publishing flow: `version` → format + `git add -A src`, `postversion` → pushes
  tags, `prepublishOnly` → `npm test`. Don't run `npm version`/publish unasked.
