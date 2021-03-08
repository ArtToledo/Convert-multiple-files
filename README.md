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

### Install

`npm i convert-multiple-files`

### Usage

```javascript
import { convert } from 'convert-multiple-files';
import * as path from 'path';

async teste() {
  // Return promise => convert(path of the file to be converted, convertTo, outputDir)
  const pathOutput = await convert(path.resolve(__dirname, 'teste.doc'), 'pdf', path.resolve(__dirname));
  console.log(pathOutput);
}

teste();
```
