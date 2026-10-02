// Uses existing VS Code formatters. Default/--check checks; --write formats first-party tracked sources.
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const installed = join(homedir(), 'AppData/Local/Programs/Microsoft VS Code');
const root = process.env.VSCODE_FORMAT_EXTENSIONS || fs.readdirSync(installed).map(name => join(installed, name, 'resources/app/extensions')).find(path => fs.existsSync(join(path, 'node_modules/typescript/lib/typescript.js')));
if (!root)
	throw Error('Existing VS Code TypeScript/HTML/CSS formatters are required; no software is installed automatically.');
const ts = require(root + '/node_modules/typescript/lib/typescript.js');
function parse(s, file) {
	const n = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	if (n.parseDiagnostics.length)
		throw Error(file + ': ' + n.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; '));
	return n;
}
function signature(n) {
	const children = [];
	ts.forEachChild(n, c => {
		children.push(signature(c));
	});
	return [n.kind, n.escapedText ?? null, ts.isLiteralExpression(n) || ts.isTemplateLiteralToken(n) ? n.text : null, n.rawText ?? null, n.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const), children];
}
function comments(n, s) {
	const found = new Map();
	function add(ranges) {
		for (const r of ranges || [])
			found.set(r.pos, s.slice(r.pos, r.end).split(/\r?\n/).map(x => x.trim()).join('\n'));
	}
	function walk(x) {
		add(ts.getLeadingCommentRanges(s, x.pos));
		add(ts.getTrailingCommentRanges(s, x.end));
		ts.forEachChild(x, walk);
	}
	walk(n);
	return [...found.values()].sort();
}
function js(s, file) {
	const ast = parse(s, file), before = JSON.stringify(signature(ast)), notes = JSON.stringify(comments(ast, s));
	function expand(n) {
		if (ts.isBlock(n) || ts.isObjectLiteralExpression(n)) {
			n.multiLine = true;
			ts.setEmitFlags(n, ts.EmitFlags.MultiLine);
			if (ts.isObjectLiteralExpression(n))
				for (const property of n.properties)
					ts.setStartsOnNewLine(property, true);
		}
		ts.forEachChild(n, expand);
	}
	expand(ast);
	let out = ts.createPrinter({
		newLine: ts.NewLineKind.LineFeed
	}).printFile(ast);
	const printed = parse(out, file), options = {
		indentSize: 4, tabSize: 4, convertTabsToSpaces: false, newLineCharacter: '\n', insertSpaceAfterCommaDelimiter: true, insertSpaceAfterKeywordsInControlFlowStatements: true, insertSpaceBeforeAndAfterBinaryOperators: true, insertSpaceAfterSemicolonInForStatements: true, insertSpaceAfterFunctionKeywordForAnonymousFunctions: true
	};
	const edits = ts.formatting.formatDocument(printed, ts.formatting.getFormatContext(options));
	for (const e of edits.sort((a, b) => b.span.start - a.span.start))
		out = out.slice(0, e.span.start) + e.newText + out.slice(e.span.start + e.span.length);
	const after = parse(out, file);
	if (JSON.stringify(signature(after)) !== before)
		throw Error('AST changed: ' + file);
	if (JSON.stringify(comments(after, out)) !== notes)
		throw Error('Comments changed: ' + file);
	return out;
}
async function lsp(kind) {
	const child = spawn(process.execPath, [root + '/' + kind + '-language-features/server/dist/node/' + kind + 'ServerMain.js', '--stdio'], {
		windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
	});
	let id = 0, buffer = Buffer.alloc(0);
	const waiting = new Map();
	function send(v) {
		const body = JSON.stringify(v);
		child.stdin.write('Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
	}
	child.stdout.on('data', data => {
		buffer = Buffer.concat([buffer, data]);
		for (; ;) {
			const i = buffer.indexOf('\r\n\r\n');
			if (i < 0)
				return;
			const len = Number(buffer.subarray(0, i).toString().match(/Content-Length: (\d+)/i)[1]);
			if (buffer.length < i + 4 + len)
				return;
			const v = JSON.parse(buffer.subarray(i + 4, i + 4 + len));
			buffer = buffer.subarray(i + 4 + len);
			if (v.method && v.id !== undefined)
				send({
					jsonrpc: '2.0', id: v.id, result: null
				});
			else if (waiting.has(v.id)) {
				const p = waiting.get(v.id);
				waiting.delete(v.id);
				clearTimeout(p.timer);
				v.error ? p.reject(Error(JSON.stringify(v.error))) : p.resolve(v.result);
			}
		}
	});
	function request(method, params) {
		return new Promise((resolve, reject) => {
			const n = ++id;
			waiting.set(n, {
				resolve, reject, timer: setTimeout(() => reject(Error('LSP timeout ' + method)), 20000)
			});
			send({
				jsonrpc: '2.0', id: n, method, params
			});
		});
	}
	await request('initialize', {
		processId: process.pid, rootUri: null, capabilities: {}
	});
	send({
		jsonrpc: '2.0', method: 'initialized', params: {}
	});
	return {
		async format(text, language, file) {
			const uri = pathToFileURL(process.cwd() + '/' + file).href;
			send({
				jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
					textDocument: {
						uri, languageId: language, version: 1, text
					}
				}
			});
			const edits = await request('textDocument/formatting', {
				textDocument: {
					uri
				}, options: {
					tabSize: 4, insertSpaces: false
				}
			});
			const starts = [0];
			for (let i = 0; i < text.length; i++)
				if (text[i] === '\n')
					starts.push(i + 1);
			const offset = p => starts[p.line] + p.character;
			let out = text;
			for (const e of (edits || []).sort((a, b) => offset(b.range.start) - offset(a.range.start)))
				out = out.slice(0, offset(e.range.start)) + e.newText + out.slice(offset(e.range.end));
			send({
				jsonrpc: '2.0', method: 'textDocument/didClose', params: {
					textDocument: {
						uri
					}
				}
			});
			return out;
		}, close() {
			child.kill();
		}
	};
}
const files = execFileSync('git', ['ls-files', '*.js', '*.mjs', '*.jslib', '*.html', '*.css'], {
	encoding: 'utf8'
}).trim().split(/\r?\n/).filter(x => !/(^|\/)(vendor|node_modules|Builds|Library)\//.test(x));
for (const extra of ['tools/format-web.mjs', 'tests/source-format-helper.mjs'])
	if (fs.existsSync(extra) && !files.includes(extra))
		files.push(extra);
const outputs = [];
let html, css;
try {
	for (const file of files) {
		const s = fs.readFileSync(file, 'utf8');
		let out;
		if (/\.(m?js|jslib)$/.test(file))
			out = js(s, file);
		else if (file.endsWith('.css')) {
			css ??= await lsp('css');
			out = await css.format(s, 'css', file);
			if (s.replace(/\s/g, '') !== out.replace(/\s/g, ''))
				throw Error('CSS non-whitespace changed: ' + file);
		}
		else {
			html ??= await lsp('html');
			let input = s;
			if (file === 'Assets/WebGLTemplates/History/index.html') {
				const start = input.indexOf('<script>') + 8, end = input.indexOf('</script>', start);
				if (start < 8 || end < start)
					throw Error('Template script not found');
				input = input.slice(0, start) + '\n' + js(input.slice(start, end), file + '.js') + input.slice(end);
			}
			out = await html.format(input, 'html', file);
			if (input.replace(/\s/g, '') !== out.replace(/\s/g, ''))
				throw Error('HTML non-whitespace changed: ' + file);
		}
		outputs.push([file, out]);
	}
	const changed = outputs.filter(([file, out]) => fs.readFileSync(file, 'utf8') !== out);
	if (process.argv.includes('--write'))
		for (const [file, out] of changed)
			fs.writeFileSync(file, out);
	else if (changed.length)
		process.exitCode = 1;
	console.log(JSON.stringify({
		files: outputs.length, changed: changed.map(([file]) => file), written: process.argv.includes('--write'), verification: 'JavaScript parsed AST/comment preservation; HTML/CSS non-whitespace preservation'
	}, null, 2));
}
finally {
	html?.close();
	css?.close();
}
