import { readFile, writeFile, mkdir } from 'node:fs/promises';
const out = 'browser/engine';
await mkdir(out, {
	recursive: true
});
const files = ['game', 'commanders', 'presentation', 'setup-clock', 'turn-clock', 'battle-continue', 'emotes'];
for (const f of files) {
	let s = await readFile('server/' + f + '.mjs', 'utf8');
	s = s.replaceAll("from 'node:crypto'", "from './random.mjs'").replaceAll("'../web/formation.mjs'", "'./formation.mjs'").replaceAll("'../tools/demo-policy.mjs'", "'./demo-policy.mjs'");
	if (f === 'commanders') {
		s = s.replace("import { readFileSync } from 'node:fs';", '');
		s = s.replace("JSON.parse(readFileSync(new URL('./commanders.json', import.meta.url), 'utf8'))", await readFile('server/commanders.json', 'utf8'));
	}
	await writeFile(out + '/' + f + '.mjs', s);
}
for (const f of ['demo-policy', 'mobility-policy', 'public-knowledge', 'pressure-policy'])
	await writeFile(out + '/' + f + '.mjs', await readFile('tools/' + f + '.mjs'));
await writeFile(out + '/formation.mjs', await readFile('web/formation.mjs'));
let s = await readFile('server/server.mjs', 'utf8');
s = s.slice(0, s.indexOf('export function serve('));
s = s.replace(/^import .* from 'node:.*';\r?\n/gm, '').replace(/^const ROOT = .*;\r?\n/m, '');
s = s.replaceAll("'../web/formation.mjs'", "'./formation.mjs'");
s = "import {randomBytes} from './random.mjs';\n" + s;
s = s.replace('teacherKey, classCode, students, matches, revokedTokens, __perspectiveChoices:', `exportSnapshot: () => ({phase, order, pairedCount, presence, perspectives:[...perspectiveChoices], removedStudents:[...removedStudents], revokedTokens:[...revokedTokens], emotes:[...emoteRecords], students:[...tokens].map(([token,p])=>({...p,token})), matches:[...matches.values()].map(m=>({...compactHistory(m),requests:[...m.requests]})), archives:[...archives.values()].map(m=>({...compactHistory(m),requests:[...m.requests]}))}), teacherKey, classCode, students, matches, revokedTokens, __perspectiveChoices:`);
await writeFile(out + '/authority.mjs', s);
await writeFile(out + '/random.mjs', `export const randomUUID=()=>crypto.randomUUID();
export function randomBytes(n){const a=crypto.getRandomValues(new Uint8Array(n));return {toString:()=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};}
export function randomInt(n){const limit=Math.floor(4294967296/n)*n;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0];}while(x>=limit);return x%n;}`);
console.log('Browser engine generated from tested rules; no Node runtime imports.');
