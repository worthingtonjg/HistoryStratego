// Same seeded algorithm as ArmyFormation.cs; indices are relative to the owner's
// front row (0..9) through back row (30..39). No opponent state is an input.
export function generateFormation(seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
	let state = (seed >>> 0) || 0x6d2b79f5;
	const next = n => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return Math.floor((state >>> 0) / 4294967296 * n);
	};
	const shuffle = a => {
		for (let i = a.length - 1; i > 0; i--) {
			const j = next(i + 1);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};
	const ranks = ['F', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], counts = [1, 6, 1, 8, 5, 4, 4, 4, 3, 2, 1, 1], cells = Array(40).fill(null);
	const column = next(10), flag = 30 + column;
	cells[flag] = 'F';
	cells[flag - 10] = 'B';
	if (column > 0)
		cells[flag - 1] = 'B';
	if (column < 9)
		cells[flag + 1] = 'B';
	for (const i of shuffle(Array.from({
		length: 10
	}, (_, i) => i)).slice(0, 8))
		cells[i] = '2';
	for (const i of shuffle(Array.from({length: 10}, (_, i) => 30 + i).filter(i => cells[i] === null)).slice(0, 5))
		cells[i] = '3';
	const bag = [];
	for (let i = 0; i < ranks.length; i++)
		for (let n = cells.filter(r => r === ranks[i]).length; n < counts[i]; n++)
			bag.push(ranks[i]);
	shuffle(bag);
	let cursor = 0;
	for (let i = 0; i < 40; i++)
		if (cells[i] === null)
			cells[i] = bag[cursor++];
	return cells;
}
// Student-led setup: only fill empty cells. Earlier choices are never optimized.
export function fillFormation(draft, stage = 3, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
 if (!Array.isArray(draft) || draft.length !== 40 || ![1,2,3].includes(stage)) throw Error('Invalid formation draft');
 const inventory={F:1,B:6,'1':1,'2':8,'3':5,'4':4,'5':4,'6':4,'7':3,'8':2,'9':1,'10':1};
 const cells=draft.map(r=>r==null||r===''?null:r), count={};
 for(const r of cells)if(r!==null){if(!(r in inventory)||(count[r]=(count[r]||0)+1)>inventory[r])throw Error('Invalid formation inventory');}
 let state=(seed>>>0)||0x6d2b79f5;
 const next=n=>{state^=state<<13;state^=state>>>17;state^=state<<5;return Math.floor((state>>>0)/4294967296*n);};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=next(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const empty=()=>cells.map((r,i)=>r===null?i:-1).filter(i=>i>=0);
 if(!count.F){let slots=empty().filter(i=>i>=30);if(!slots.length)slots=empty();cells[slots[next(slots.length)]]='F';count.F=1;}
 if(stage>=2){const slots=shuffle(empty());for(let n=count.B||0;n<6;n++)cells[slots.pop()]='B';}
 if(stage===3){
  let scouts=8-cells.filter(r=>r==='2').length;
  for(const i of shuffle(empty().filter(i=>i<10))){if(scouts===0)break;cells[i]='2';scouts--;}
  let miners=5-cells.filter(r=>r==='3').length;
  for(const i of shuffle(empty().filter(i=>i>=30))){if(miners===0)break;cells[i]='3';miners--;}
  const bag=[];for(const [rank,total] of Object.entries(inventory))for(let n=cells.filter(r=>r===rank).length;n<total;n++)bag.push(rank);
  shuffle(bag);for(const i of empty())cells[i]=bag.pop();
 }
 return cells;
}
export const flagFormation = seed => fillFormation(Array(40).fill(null),1,seed);
export const shuffleRemaining = (draft,seed) => fillFormation(draft.map(r=>r==='F'||r==='B'?r:null),3,seed);
