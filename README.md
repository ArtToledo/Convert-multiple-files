# Convert multiple files
File converter for various types, tested on linux and windows.

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