// Preserve quoted label contents while ignoring formatting whitespace in source guards.
export function compactCode(source) {
	return source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\s+/g, token => /^\s/.test(token) ? '' : token);
}
export function containsCode(source, expected) {
	return compactCode(source).includes(compactCode(expected));
}
