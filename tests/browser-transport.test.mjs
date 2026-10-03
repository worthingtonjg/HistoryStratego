import { acceptUnityTeacherGate } from '../browser/teacher-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectClassroom, seal, open } from '../browser/transport.mjs';
function environment() {
	const store = new Map(), listeners = new Set();
	globalThis.localStorage = {
		getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)
	};
	globalThis.document = {
		hidden: false, addEventListener(name,fn) { if(name==='visibilitychange')listeners.add(fn);
		}, removeEventListener(name,fn) { listeners.delete(fn);
		}
	};
	globalThis.location = {
		href: 'https://example.test/HistoryStratego/'
	};
	globalThis.history = {
		replaceState() {
		}
	};
	const state = {}, clients = [], packets = [];
	const sdk = id => {
		let sdkRoom = 'ROOM';
		const callbacks = new Map(), client = {
			myPlayer: () => ({
				id
			}), getRoomCode: () => sdkRoom, insertCoin: async (options) => {
				sdkRoom = options.roomCode || 'ROOM';
			}, setState: (k, v) => state[k] = v, getState: k => state[k], RPC: {
				Mode: {
					ALL: 0
				}, register: (n, f) => {
					callbacks.set(n, f);
					return () => callbacks.delete(n);
				}, call: async (n, p) => {
					packets.push({
						n, p
					});
					for (const c of clients)
						queueMicrotask(() => c.callbacks.get(n)?.(p, {
							id
						}));
				}
			}
		};
		clients.push({
			callbacks
		});
		return client;
	};
	return {
		sdk, packets, store, visibility(hidden) { document.hidden=hidden;for(const fn of listeners)fn(); }
	};
}
test('browser authority encrypts student messages, retains redaction and rejects remote teacher control', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('teacher')
	}), student = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('student')
	});
	try {
		const joined = await student.request('join', {
			classCode: teacher.code
		});
		assert(joined.token);
		assert.equal((await student.request('join', {
			classCode: teacher.code
		})).token, joined.token, 'retrying initial join does not duplicate the seat');
		assert(!JSON.stringify(env.packets).includes(joined.token));
		const denied = await student.request('teacher/start');
		assert.match(denied.error, /local/);
		teacher.pause();
		assert.equal((await student.request('state', {}, joined.token)).phase, 'waiting');
		assert.equal(student.role, 'student');
		assert(!JSON.stringify([...env.store.values()]).includes(joined.token));
	}
	finally {
		teacher.close();
		student.close();
	}
});
test('private recovery restores local checkpoint but rejects incorrect recovery credential', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('teacher')
	});
	let recovered;
	try {
		const joined = await teacher.request('join', {
			classCode: teacher.code
		});
		await assert.rejects(connectClassroom({
			role: 'recover', teacherAccess: acceptUnityTeacherGate(), code: teacher.code, recovery: '00'.repeat(32), sdk: env.sdk('bad')
		}));
		recovered = await connectClassroom({
			role: 'recover', teacherAccess: acceptUnityTeacherGate(), code: teacher.code, recovery: teacher.recovery, sdk: env.sdk('recovered')
		});
		assert.equal(recovered.code, teacher.code);
		assert.equal((await recovered.request('state', {}, joined.token)).player, joined.player);
	}
	finally {
		teacher.close();
		recovered?.close();
	}
});
test('payload encryption rejects a different recipient key and tampering', async () => {
	const key = await crypto.subtle.generateKey({
		name: 'AES-GCM', length: 256
	}, false, ['encrypt', 'decrypt']), other = await crypto.subtle.generateKey({
		name: 'AES-GCM', length: 256
	}, false, ['encrypt', 'decrypt']);
	const p = await seal(key, {
		rank: '10'
	});
	assert.equal((await open(key, p)).rank, '10');
	await assert.rejects(open(other, p));
	p.data = 'AAAA' + p.data.slice(4);
	await assert.rejects(open(key, p));
});
test('two browser seats play through combat, pause and teacher recovery with redacted views', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('teacher')
	}), one = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('one')
	}), two = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('two')
	});
	let recovered;
	try {
		const seats = await Promise.all([one, two].map(p => p.request('join', {
			classCode: teacher.code
		})));
		await teacher.request('teacher/start');
		const m = [...teacher.authority.matches.values()][0];
		m.phase = 'play';
		m.ready = [true, true];
		m.setupClocks = null;
		m.turnClock = null;
		m.board.fill(null);
		for (const [i, side, rank] of [[60, 0, '3'], [50, 1, 'B'], [99, 0, 'F'], [0, 1, 'F'], [1, 1, '2']])
			m.board[i] = {
				id: String(i), side, rank
			};
		const clients = [one, two], views = await Promise.all(clients.map((p, i) => p.request('state', {}, seats[i].token))), active = views.findIndex(v => v.match.side === 0), other = 1 - active;
		assert.equal(views[active].match.board[50].rank, '?');
		let result = await clients[active].request('move', {
			from: 60, to: 50, seq: m.seq, requestId: 'browser-combat'
		}, seats[active].token);
		assert(!result.error, result.error);
		assert.equal(result.match.battle.defender, 'B');
		const seq = m.seq;
		await clients[active].request('ack', {
			matchId: m.id, seq
		}, seats[active].token);
		await clients[other].request('ack', {
			matchId: m.id, seq
		}, seats[other].token);
		assert.equal(m.reveal, null);
		assert.equal(m.turn, 1);
		await teacher.request('teacher/pause');
		assert.equal((await one.request('state', {}, seats[0].token)).phase, 'paused');
		const denied = await two.request('move', {
			from: 1, to: 11, seq: m.seq, requestId: 'paused'
		}, seats[1].token);
		assert(denied.error);
		// Recovery in the original profile uses only the private locally encrypted checkpoint.
		recovered = await connectClassroom({
			role: 'recover', teacherAccess: acceptUnityTeacherGate(), code: teacher.code, recovery: teacher.recovery, sdk: env.sdk('new-host-owner')
		});
		assert.equal((await recovered.request('state', {}, seats[0].token)).phase, 'paused');
		assert.equal(recovered.authority.matches.get(m.id).seq, seq);
	}
	finally {
		teacher.close();
		one.close();
		two.close();
		recovered?.close();
	}
});
test('normal teacher create and recovery require a Unity-issued convenience approval', async () => {
	const env = environment();
	await assert.rejects(connectClassroom({
		role: 'teacher', sdk: env.sdk('blocked')
	}), /unlock/);
	await assert.rejects(connectClassroom({
		role: 'recover', code: 'ROOM-0000000000000000', recovery: '0'.repeat(64), sdk: env.sdk('blocked-recover')
	}), /unlock/);
	await assert.rejects(connectClassroom({
		role: 'teacher', teacherAccess: {}, sdk: env.sdk('forged')
	}), /unlock/);
});
test('New class retires old code, token and recovery while admitting only the fresh class', async () => {
	const env = environment(), access = acceptUnityTeacherGate();
	const teacher = await connectClassroom({
		role: 'teacher', teacherAccess: access, sdk: env.sdk('old-teacher')
	});
	const student = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('old-student')
	});
	const seat = await student.request('join', {
		classCode: teacher.code
	});
	await teacher.addComputer();
	await teacher.request('teacher/start');
	const saving = teacher.request('teacher/state');
	await teacher.retire();
	await saving;
	const checkpointKey = await crypto.subtle.importKey('raw', Buffer.from(teacher.recovery, 'hex'), {
		name: 'AES-GCM'
	}, false, ['decrypt']);
	assert.equal((await open(checkpointKey, JSON.parse(env.store.get('history.teacher.' + teacher.code)))).retired, true);
	assert.equal((await student.request('state', {}, seat.token)).phase, 'ended');
	assert.match((await student.request('move', {
		from: 60, to: 50
	}, seat.token)).error, /Class ended/);
	assert.match((await teacher.request('teacher/resume')).error, /Class ended/);
	await assert.rejects(connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('late-old')
	}), /Class ended/);
	await assert.rejects(connectClassroom({
		role: 'recover', code: teacher.code, recovery: teacher.recovery, teacherAccess: access, sdk: env.sdk('recover-old')
	}), /Class ended/);
	assert(env.store.has('history.teacher.' + teacher.code), 'retained encrypted checkpoint is not deleted');
	const freshSdk = env.sdk('new-teacher');
	const previousGet = freshSdk.getState;
	freshSdk.getState = key => key === 'historyTeacher' ? undefined : previousGet(key);
	freshSdk.getRoomCode = () => 'NEXT';
	const fresh = await connectClassroom({
		role: 'teacher', teacherAccess: access, sdk: freshSdk
	});
	const newcomer = await connectClassroom({
		role: 'student', code: fresh.code, sdk: env.sdk('new-student')
	});
	try {
		assert.notEqual(fresh.code, teacher.code);
		assert.equal((await fresh.request('teacher/state')).roster.length, 0);
		assert((await newcomer.request('join', {
			classCode: fresh.code
		})).token);
		assert.equal((await fresh.request('teacher/state')).roster.length, 1);
		assert.equal((await student.request('state', {}, seat.token)).phase, 'ended');
	}
	finally {
		teacher.close();
		student.close();
		fresh.close();
		newcomer.close();
	}
});
test('current classroom and NPC seat recover after reopening without duplicate roster entries', async () => {
	const env = environment(), access = acceptUnityTeacherGate();
	const { currentClassroom } = await import('../browser/classroom-memory.mjs');
	const first = await connectClassroom({
		role: 'teacher', teacherAccess: access, sdk: env.sdk('owner')
	});
	await first.addComputer();
	const before = await first.request('teacher/state');
	assert.equal(before.roster.length, 1);
	const remembered = currentClassroom();
	assert.equal(remembered.code, first.code);
	first.close();
	await new Promise(r => setTimeout(r, 10));
	const restored = await connectClassroom({
		role: 'recover', teacherAccess: access, code: remembered.code, recovery: remembered.recovery, sdk: env.sdk('restored')
	});
	try {
		const after = await restored.request('teacher/state');
		assert.equal(after.roster.length, 1);
		assert.equal(after.roster[0].id, before.roster[0].id);
		assert.equal(currentClassroom().code, first.code);
	}
	finally {
		restored.close();
	}
});
test('short student code joins current teacher but reconnect retains the full classroom identity', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('t')
	});
	const student = await connectClassroom({
		role: 'student', code: 'ROOM', sdk: env.sdk('s')
	});
	try {
		assert.equal(student.code, teacher.code);
		assert.equal(student.joinCode, 'ROOM');
		assert((await student.request('join', {
			classCode: student.code
		})).token);
	}
	finally {
		teacher.close();
		student.close();
	}
});
test('teacher creation clears stale invite hash and refuses an existing classroom owner', async () => {
	const env = environment();
	location.href = 'https://example.test/teacher.html#r=ROLD';
	let cleaned;
	history.replaceState = (_, __, url) => {
		cleaned = url.hash;
	};
	const teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('owner')
	});
	try {
		assert.equal(cleaned, '');
		await assert.rejects(connectClassroom({
			role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('collision')
		}), /already owned/);
	}
	finally {
		teacher.close();
	}
});
test('encrypted student transport delivers allowlisted messages and enforces cooldown', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', teacherAccess: acceptUnityTeacherGate(), sdk: env.sdk('message-teacher')
	}), one = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('message-one')
	}), two = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('message-two')
	});
	try {
		const seats = await Promise.all([one, two].map(p => p.request('join', {
			classCode: teacher.code
		})));
		await teacher.request('teacher/start');
		const m = [...teacher.authority.matches.values()][0];
		m.phase = 'play';
		m.ready = [true, true];
		m.setupClocks = null;
		m.timedTurns = false;
		const sent = await one.request('emote', {
			matchId: m.id, emoteId: 'greeting'
		}, seats[0].token);
		assert(!sent.error, sent.error);
		const other = await two.request('state', {}, seats[1].token);
		assert.equal(other.match.emotes[0].text, 'Greetings, General!');
		const watcher = await teacher.request('teacher/spectate', {
			matchId: m.id
		});
		assert.equal(watcher.match.emotes[0].text, 'Greetings, General!');
		const denied = await one.request('emote', {
			matchId: m.id, emoteId: 'greeting'
		}, seats[0].token);
		assert.match(denied.error, /Wait/);
	}
	finally {
		one.close();
		two.close();
		teacher.close();
	}
});
function tabStorage(){const values=new Map();return{values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('student refresh restores one waiting/active seat across concurrent joins, lost token, and teacher recovery',async()=>{
 const env=environment(),storage=tabStorage(),access=acceptUnityTeacherGate();let teacher=await connectClassroom({role:'teacher',teacherAccess:access,sdk:env.sdk('refresh-owner')});let student,other;
 try{
 student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('first-page'),studentStorage:storage});
 const seats=await Promise.all(Array.from({length:3},()=>student.request('join',{classCode:teacher.code})));assert(seats.every(s=>s.player===seats[0].player));assert.equal(teacher.authority.students.size,1);
 const original=seats[0],key='history.student.'+teacher.code;assert.equal(JSON.parse(storage.getItem(key)).token,original.token);
 student.close();let saved=JSON.parse(storage.getItem(key));saved.token='';storage.setItem(key,JSON.stringify(saved));storage.removeItem('studentToken'); // Lost initial response/Unity token: retained key must still recover allocation.
 student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('reload-waiting'),studentStorage:storage});const restored=await student.request('join',{classCode:teacher.code});assert.equal(restored.player,original.player);assert.deepEqual(restored.commander,original.commander);assert.equal(teacher.authority.students.size,1);
 other=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('distinct-student'),studentStorage:tabStorage()});const distinct=await other.request('join',{classCode:teacher.code});assert.notEqual(distinct.player,original.player);await teacher.request('teacher/start');const match=(await student.request('state')).match.id;
 student.close();student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('reload-active'),studentStorage:storage});assert.equal((await student.request('join',{classCode:teacher.code})).match.id,match);assert.equal(teacher.authority.students.size,2);
 const code=teacher.code,recovery=teacher.recovery;teacher.close();await new Promise(r=>setTimeout(r,20));teacher=await connectClassroom({role:'recover',code,recovery,teacherAccess:access,sdk:env.sdk('recovered-owner')});student.close();student=await connectClassroom({role:'student',code,sdk:env.sdk('after-recovery'),studentStorage:storage});assert.equal((await student.request('join',{classCode:code})).player,original.player);assert.equal(teacher.authority.students.size,2);
 const invalid=await student.request('join',{classCode:code},'invalid-seat');assert.match(invalid.error,/not valid/);assert.equal(teacher.authority.students.size,2);
 await teacher.retire();assert.equal((await student.request('state')).classRetired,true);await assert.rejects(connectClassroom({role:'student',code,sdk:env.sdk('retired-reload'),studentStorage:storage}),/Class ended/);assert.equal(teacher.authority.students.size,2);
 }finally{student?.close();other?.close();teacher?.close();}
});
test('teacher removal revokes transport identity across reload and recovery and stops owned computer',async()=>{
 const env=environment(),storage=tabStorage(),access=acceptUnityTeacherGate();let teacher=await connectClassroom({role:'teacher',teacherAccess:access,sdk:env.sdk('remove-owner')});let student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('remove-seat'),studentStorage:storage});
 try{const seat=await student.request('join',{classCode:teacher.code});await teacher.request('teacher/remove',{a:seat.player});assert.equal((await student.request('state')).removed,true);student.close();student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('removed-refresh'),studentStorage:storage});assert.equal((await student.request('join',{classCode:teacher.code})).removed,true);assert.equal(teacher.authority.students.size,0);
 await teacher.addComputer();const bot=[...teacher.authority.students.values()][0];await teacher.request('teacher/remove',{a:bot.id});assert.equal(teacher.authority.students.size,0);const code=teacher.code,recovery=teacher.recovery;teacher.close();await new Promise(r=>setTimeout(r,20));teacher=await connectClassroom({role:'recover',code,recovery,teacherAccess:access,sdk:env.sdk('remove-recover')});assert.equal(teacher.authority.students.size,0);assert.equal((await student.request('state')).removed,true);
 }finally{student.close();teacher.close();}
});
test('explicit new classroom uses a fresh seat despite old Unity token; refresh and same-class removal remain protected',async()=>{
 const {prepareStudentJoin,classroomRequestToken}=await import('../browser/student-session.mjs');const env=environment(),storage=tabStorage(),access=acceptUnityTeacherGate();let first=await connectClassroom({role:'teacher',teacherAccess:access,sdk:env.sdk('old-owner')}),student=await connectClassroom({role:'student',code:first.code,sdk:env.sdk('old-student'),studentStorage:storage}),second,reloaded;
 try{const old=await student.request('join',{classCode:first.code});storage.setItem('history.browserSession',JSON.stringify({role:'student',code:first.code}));await first.retire();assert.equal((await student.request('join',{classCode:first.code})).classRetired,true);student.close();first.close();
 const sdk=env.sdk('new-owner');sdk.getState=()=>undefined;sdk.getRoomCode=()=> 'NEXT';second=await connectClassroom({role:'teacher',teacherAccess:access,sdk});prepareStudentJoin(storage,'NEXT');
 student=await connectClassroom({role:'student',code:second.code,sdk:env.sdk('new-student-real-fixture'),studentStorage:storage});assert.equal(storage.getItem('studentToken'),null);
 const seat=await student.request('join',{classCode:second.code},classroomRequestToken(false,old.token));assert(!seat.error,seat.error);assert.notEqual(seat.player,old.player);assert.equal(second.authority.students.size,1);assert.equal(storage.getItem('studentToken'),seat.token);student.close();
 reloaded=await connectClassroom({role:'student',code:second.code,sdk:env.sdk('new-refresh'),studentStorage:storage});assert.equal((await reloaded.request('join',{classCode:second.code})).player,seat.player);assert.equal(second.authority.students.size,1);await second.request('teacher/remove',{a:seat.player});assert.equal((await reloaded.request('join',{classCode:second.code})).removed,true);assert.equal(second.authority.students.size,0);
 }finally{first.close();student?.close();second?.close();reloaded?.close();}
});
test('legacy token migrates only into its exact existing classroom and resumes the allocated commander',async()=>{
 const {prepareStudentJoin}=await import('../browser/student-session.mjs'),env=environment(),storage=tabStorage();const teacher=await connectClassroom({role:'teacher',teacherAccess:acceptUnityTeacherGate(),sdk:env.sdk('legacy-owner')});let student;
 try{const old=await teacher.request('join',{classCode:teacher.code});storage.setItem('history.browserSession',JSON.stringify({role:'student',code:teacher.code}));storage.setItem('studentToken',old.token);prepareStudentJoin(storage,teacher.joinCode);student=await connectClassroom({role:'student',code:teacher.joinCode,sdk:env.sdk('legacy-seat'),studentStorage:storage});const restored=await student.request('join',{classCode:teacher.code});assert.equal(restored.player,old.player);assert.deepEqual(restored.commander,old.commander);assert.equal(teacher.authority.students.size,1);}finally{student?.close();teacher.close();}
});

 test('background visibility and delayed host timer do not pause; manual pause stays authoritative', async()=>{
 const env=environment(),teacher=await connectClassroom({role:'teacher',teacherAccess:acceptUnityTeacherGate(),sdk:env.sdk('teacher')}),student=await connectClassroom({role:'student',code:teacher.code,sdk:env.sdk('student')});
 try {
 const seat=await student.request('join',{classCode:teacher.code});
 teacher.authority.call('join',{classCode:teacher.code});
 await teacher.request('teacher/start');
 env.visibility(true);
 await new Promise(r=>setTimeout(r,350));
 assert.equal((await student.request('state',{},seat.token)).phase,'active');
 const previous=performance.now;const offset=performance.now()+10000;
 Object.defineProperty(performance,'now',{value:()=>offset,configurable:true});
 try {assert.equal((await student.request('state',{},seat.token)).phase,'active');}finally{Object.defineProperty(performance,'now',{value:previous,configurable:true});}
 await teacher.request('teacher/pause');env.visibility(false);
 assert.equal((await student.request('state',{},seat.token)).phase,'paused');
 env.visibility(true);assert.equal((await student.request('state',{},seat.token)).phase,'paused');
 } finally {teacher.close();student.close();}
 });

test('large real match history checkpoint saves and recovers without truncating moves or student identity',async()=>{
 const {move}=await import('../browser/engine/game.mjs');const env=environment(),teacher=await connectClassroom({role:'teacher',teacherAccess:acceptUnityTeacherGate(),sdk:env.sdk('large-teacher')});let recovered;
 try{const seats=[];for(let i=0;i<2;i++)seats.push(await teacher.request('join',{classCode:teacher.code}));await teacher.request('teacher/start');const m=[...teacher.authority.matches.values()][0];m.phase='play';m.ready=[true,true];m.setupClocks=null;m.timedTurns=false;m.board.fill(null);for(const[i,side,rank]of[[72,0,'6'],[27,1,'6'],[99,0,'F'],[0,1,'F']])m.board[i]={id:String(i),side,rank};
 for(let n=0;n<1200;n++){const side=n%2,k=Math.floor(n/2),a=side===0?72:27,b=side===0?62:37;move(m,side,k%2?b:a,k%2?a:b,m.seq,'large-'+n);}
 const serialized=JSON.stringify(teacher.authority.exportSnapshot());assert(serialized.length>131072);assert.throws(()=>String.fromCharCode(...new TextEncoder().encode(serialized)),RangeError);
 await teacher.request('teacher/state');const record=env.store.get('history.teacher.'+teacher.code);assert(record.length>131072);const key=await crypto.subtle.importKey('raw',Buffer.from(teacher.recovery,'hex'),{name:'AES-GCM'},false,['decrypt']);const decoded=await open(key,JSON.parse(record));assert.equal(decoded.snapshot.matches[0].events.length,1200);assert(!record.includes('large-1199'));
 recovered=await connectClassroom({role:'recover',teacherAccess:acceptUnityTeacherGate(),code:teacher.code,recovery:teacher.recovery,sdk:env.sdk('large-recovery')});assert.equal(recovered.authority.matches.get(m.id).events.length,1200);assert.equal(recovered.authority.matches.get(m.id).seq,1200);const restored=await recovered.request('state',{},seats[0].token);assert.equal(restored.player,seats[0].player);assert.equal(restored.phase,'paused');assert(restored.match.board.filter(p=>p&&p.side!==restored.match.side).every(p=>p.rank==='?'));
 }finally{teacher.close();recovered?.close();}
});
