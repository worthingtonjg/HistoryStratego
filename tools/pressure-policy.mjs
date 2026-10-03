// Occupancy-only paths to attack approaches. Never reads an opposing rank.
const lakes=new Set([42,43,46,47,52,53,56,57]);
const adjacent=i=>[i-10,i+10,...(i%10?[i-1]:[]),...(i%10<9?[i+1]:[])].filter(j=>j>=0&&j<100&&!lakes.has(j));
export function attackApproaches(board,side,knownBombs=new Set()) {
 const distances=new Map(),queue=[];
 for(let i=0;i<100;i++)if(board[i]?.side===1-side&&!knownBombs.has(i))for(const j of adjacent(i))if(!board[j]&&!distances.has(j)){distances.set(j,0);queue.push(j);}
 for(let n=0;n<queue.length;n++)for(const j of adjacent(queue[n]))if(!board[j]&&!distances.has(j)){distances.set(j,distances.get(queue[n])+1);queue.push(j);}
 return distances;
}
export function attackPressure(board,side,from,to,distances,events=[]) {
 const row=i=>Math.floor(i/10),depth=i=>Math.max(0,side===0?5-row(i):row(i)-4);
 const forward=side===0?row(from)-row(to):row(to)-row(from);
 const exits=adjacent(from).filter(i=>distances.has(i)).map(i=>distances.get(i)+1);
 const before=exits.length?Math.min(...exits):null,after=board[to]?.side===1-side?-1:distances.get(to);
 const approach=before!==null&&after!==undefined?Math.max(-4,Math.min(4,before-after)):0;
 const recent=events.filter(e=>e.side===side&&e.kind==='move').slice(-6);
 const reverse=!board[to]&&recent.at(-1)?.from===to&&recent.at(-1)?.to===from;
 const repeats=!board[to]?recent.filter(e=>e.from===from&&e.to===to).length:0;
 return {score:approach*4+forward*1.5+(depth(to)-depth(from))*3-(reverse?12:0)-repeats*7,approach,reverse,repeats};
}
