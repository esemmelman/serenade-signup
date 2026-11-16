import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
let html = await readFile('index.html', 'utf8');
for (const file of ['styles.css', 'app.js']) {
  const content = await readFile(file);
  const version = createHash('sha256').update(content).digest('hex').slice(0, 12);
  html = html.replace(`./${file}`, `./${file}?v=${version}`);
  await writeFile(`dist/${file}`, content);
}
await writeFile('dist/index.html', html);
