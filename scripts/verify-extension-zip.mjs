import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {
  EXTENSION_PACKAGE_FILES,
  EXTENSION_ZIP_PATH,
  LAUNCHER_BACKGROUND_EXPECTATIONS,
  LAUNCHER_CONTENT_EXPECTATIONS,
} from './extension-package-files.mjs';

function fail(message) {
  throw new Error(message);
}

function diffEntries(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((entry) => !actualSet.has(entry));
  const unexpected = actual.filter((entry) => !expectedSet.has(entry));
  return { missing, unexpected };
}

async function verifyParity(zip) {
  const zipEntries = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort();
  const expectedEntries = [...EXTENSION_PACKAGE_FILES].sort();
  const { missing, unexpected } = diffEntries(expectedEntries, zipEntries);

  if (missing.length || unexpected.length) {
    fail(
      `Zip entry mismatch.\nMissing: ${missing.join(', ') || '(none)'}\nUnexpected: ${unexpected.join(', ') || '(none)'}`
    );
  }

  for (const relativePath of EXTENSION_PACKAGE_FILES) {
    const sourcePath = path.resolve(relativePath);
    const sourceBuffer = await fs.readFile(sourcePath);
    const zipBuffer = await zip.files[relativePath].async('nodebuffer');

    if (!sourceBuffer.equals(zipBuffer)) {
      fail(`Parity mismatch for ${relativePath}: zip content differs from source file.`);
    }
  }
}

function assertContainsAll(sourceText, expectations, contextLabel) {
  for (const token of expectations) {
    if (!sourceText.includes(token)) {
      fail(`${contextLabel} missing expected token: ${token}`);
    }
  }
}

async function verifyLauncherContract(zip) {
  const contentText = await zip.files['content.js'].async('string');
  const backgroundText = await zip.files['background.js'].async('string');

  assertContainsAll(contentText, LAUNCHER_CONTENT_EXPECTATIONS, 'content.js in zip');
  assertContainsAll(backgroundText, LAUNCHER_BACKGROUND_EXPECTATIONS, 'background.js in zip');
}

async function verifyExtensionZip() {
  let archiveBuffer = null;
  try {
    archiveBuffer = await fs.readFile(path.resolve(EXTENSION_ZIP_PATH));
  } catch (error) {
    fail(`Could not read ${EXTENSION_ZIP_PATH}: ${error?.message || 'read failed'}`);
  }

  const zip = await JSZip.loadAsync(archiveBuffer);
  await verifyParity(zip);
  await verifyLauncherContract(zip);

  console.log(
    `Verified ${EXTENSION_ZIP_PATH}: ${EXTENSION_PACKAGE_FILES.length} files match source and launcher contract checks passed.`
  );
}

await verifyExtensionZip();
