import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { EXTENSION_PACKAGE_FILES, EXTENSION_ZIP_PATH } from './extension-package-files.mjs';

async function readFileOrThrow(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`Missing required extension file: ${filePath} (${error?.message || 'read failed'})`);
  }
}

async function packageExtension() {
  const zip = new JSZip();

  for (const relativePath of EXTENSION_PACKAGE_FILES) {
    const sourcePath = path.resolve(relativePath);
    const content = await readFileOrThrow(sourcePath);
    zip.file(relativePath, content);
  }

  const archiveBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });

  await fs.writeFile(path.resolve(EXTENSION_ZIP_PATH), archiveBuffer);
  console.log(
    `Packaged ${EXTENSION_PACKAGE_FILES.length} files -> ${EXTENSION_ZIP_PATH} (${archiveBuffer.length} bytes)`
  );
}

await packageExtension();
