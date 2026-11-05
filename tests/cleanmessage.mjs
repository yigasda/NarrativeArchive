// Use the real pure cleaner without loading the SillyTavern UI imports.
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/extract.js', import.meta.url), 'utf8');
export const cleanMessageURL = 'data:text/javascript;base64,' + Buffer.from(source.slice(source.indexOf('const REASONING ='), source.indexOf('export function formatExtract'))).toString('base64');
export const { cleanMessage } = await import(cleanMessageURL);
