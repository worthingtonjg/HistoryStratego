// Legacy Unity storage is only a compatibility cache; seat identity belongs to a full classroom code.
const LEGACY='history.studentLegacy';
const fullCode=code=>typeof code==='string'&&/^[A-Z0-9]+-[A-F0-9]{16}$/.test(code);
function read(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
export function prepareStudentJoin(storage,code){
 const previous=read(storage,'history.browserSession'),token=storage.getItem('studentToken');
 if(previous?.role==='student'&&fullCode(previous.code)&&token){
  const bound=storage.getItem('studentTokenClass');
  if(!bound||bound===previous.code)storage.setItem(LEGACY,JSON.stringify({code:previous.code,token}));
 }
 storage.removeItem('studentToken');storage.removeItem('studentTokenClass');
 storage.setItem('history.browserSession',JSON.stringify({role:'student',code}));
}
export function legacyStudentToken(storage,code){
 const saved=read(storage,LEGACY);if(saved?.code===code)return saved.token||'';
 const previous=read(storage,'history.browserSession'),bound=storage.getItem('studentTokenClass');
 return previous?.role==='student'&&fullCode(code)&&previous.code===code&&(!bound||bound===code)?storage.getItem('studentToken')||'':'';
}
export function activateStudentSeat(storage,code,token){
 storage.setItem('studentTokenClass',code);
 if(token)storage.setItem('studentToken',token);else storage.removeItem('studentToken');
}
export function clearStudentSession(storage){
 for(const key of ['history.browserSession','studentToken','studentTokenClass',LEGACY])storage.removeItem(key);
 // Keep per-class identities: returning to a removed/retired class must not manufacture a fresh seat.
}
export function classroomRequestToken(teacherPage,token){return teacherPage?token:'';}
