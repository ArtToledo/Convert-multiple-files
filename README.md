# Convert multiple files
File converter for various types, tested on linux and windows.

### Requirements

- Node.js >= 18
- Linux or Windows (a LibreOffice bundle is downloaded on install). On other
  platforms document conversion is unavailable, but `convertWordFileToHTML` and
  `convertToBase64` still work.

### Supported file types

Accepted file formats | Output
--- | ---
doc | docx
doc | pdf
doc | odt
docx | doc
docx | odt
docx | pdf
odt | doc
odt | docx
odt | pdf
docx | html
all | base64

### Install

`npm i convert-multiple-files`

### Convert Word files

```javascript
import { convertWordFiles } from 'convert-multiple-files';
import * as path from 'path';

async test() {
  // Return promise => convertWordFiles(path of the file to be converted, convertTo, outputDir)
  const pathOutput = await convertWordFiles(path.resolve(__dirname, 'teste.doc'), 'pdf', path.resolve(__dirname));
  console.log(pathOutput);
}

test();
```

The returned path is verified to exist; if LibreOffice fails to produce it, the
promise rejects instead of returning a path to a missing file.

An optional fourth argument controls the conversion timeout (default 60000 ms):

```javascript
await convertWordFiles(input, 'pdf', outputDir, { timeout: 120000 });
```

Conversions run against a private LibreOffice profile cloned from a shared
template kept in the system temp directory. Set `CMF_LO_PROFILE_DIR` to relocate
it if the temp directory is not writable.

### Convert many files at once

LibreOffice startup dominates conversion time, so converting a list in one call
is far faster than calling `convertWordFiles` in a loop.

```javascript
import { convertWordFilesBatch } from 'convert-multiple-files';

async test() {
  // Return promise => convertWordFilesBatch(paths of the files, convertTo, outputDir)
  const pathsOutput = await convertWordFilesBatch(['a.docx', 'b.docx', 'c.docx'], 'pdf', outputDir);
  console.log(pathsOutput);
}

test();
```

### Convert DOCX to HTML

```javascript
import { convertWordFileToHTML } from 'convert-multiple-files';
import * as path from 'path';

async test() {
  // Return promise => convertWordFileToHTML(path of the file to be converted, outputDir, outputPrefix)
  const infoOutput = await convertWordFileToHTML(path.resolve(__dirname, 'file2.docx'), path.resolve(__dirname), 'filehtml-151412');
  console.log(infoOutput);
}

test();
```

Resolves `undefined` (and writes no file) when the document produces no content.

### Convert all files to Base64

```javascript
import { convertToBase64 } from 'convert-multiple-files';
import * as path from 'path';

async test() {
  // Return promise => convertToBase64(path of the file to be converted)
  const base64 = await convertToBase64(path.resolve(__dirname, 'file2.docx'));
  console.log(base64);
}

test();
```

## Upgrading to 2.0.0

The three original functions keep their names and positional arguments, so
existing calls continue to work. What changed:

- **Node >= 18 is now required**, and the DOCX-to-HTML backend moved from the
  unmaintained `mammoth-style` fork to `mammoth`, which can render slightly
  different HTML for the same document.
- Conversion no longer blocks the event loop. It previously ran through
  `execSync`, which froze the whole process for the duration of the conversion.
- Arguments are passed to LibreOffice as an argument array instead of being
  interpolated into a shell command string.
- Each conversion runs with a private LibreOffice profile, so concurrent
  conversions no longer collide.
- Unsupported platforms now raise a clear error instead of silently returning a
  path to a file that was never created.
- The output format is validated strictly: values like `xdoc` used to slip
  through and now raise `Format to be converted not accepted`.
- Errors keep their original messages and now carry the underlying failure in
  `error.cause`.
