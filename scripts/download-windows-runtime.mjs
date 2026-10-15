import { downloadArtifact } from '@electron/get';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const destination = resolve(process.argv[2] || '../official-runtime-cache');
mkdirSync(destination, { recursive: true });
const zip = await downloadArtifact({ version: '44.0.0', platform: 'win32', arch: 'x64', artifactName: 'electron', cacheRoot: destination });
copyFileSync(zip, `${destination}/electron-v44.0.0-win32-x64.zip`);
writeFileSync(`${destination}/source.txt`, 'Official Electron v44.0.0, Windows x64. Downloaded by the locked @electron/get helper with upstream SHA256 verification. Native Windows execution is NOT_RUN in Linux.\n');
console.log(`${destination}/electron-v44.0.0-win32-x64.zip`);
