// the extension's whole stylesheet: style.css only @imports css/*.css in order, so tests read those files joined
import { readFileSync, readdirSync } from 'node:fs';
export const cssFiles = () => readdirSync(new URL('../css/', import.meta.url)).filter(f => f.endsWith('.css')).sort();
export const allCss = () => cssFiles().map(f => readFileSync(new URL(`../css/${f}`, import.meta.url), 'utf8')).join('');
