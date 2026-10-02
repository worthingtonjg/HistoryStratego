// Local QA only: use the user's ignored build input directly in the masked Unity field.
// Never log, return, screenshot, or send the value to a network service.
import { readFile } from 'node:fs/promises';
export async function unlockTeacher(page) {
	await page.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 1200));
	const point = async (x, y) => page.evaluate(`(()=>{const c=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(c.width/1200,c.height/900);return {x:c.left+(c.width-1200*s)/2+${x}*s,y:c.top+(c.height-900*s)/2+${y}*s}})()`);
	const click = async (p) => {
		await page.call('Input.dispatchMouseEvent', {
			type: 'mousePressed', button: 'left', clickCount: 1, ...p
		});
		await page.call('Input.dispatchMouseEvent', {
			type: 'mouseReleased', button: 'left', clickCount: 1, ...p
		});
	};
	await click(await point(550, 303));
	const key = (await readFile('LocalConfig/teacher-key.txt', 'utf8')).replace(/[\r\n]+$/, '');
	if (key.length < 8)
		throw Error('Local teacher key is not configured.');
	await page.call('Input.insertText', {
		text: key
	});
	await click(await point(425, 365));
}
