export function tileUV(cell,side=0,aspect=1400/899,piece=true){
 const k=side===0?cell:99-cell,x=k%10-4.5,z=4.5-Math.floor(k/10),y=piece?.326:.06,t=Math.tan(Math.PI/12),q=Math.SQRT1_2;
 const project=(x,y,z,d)=>{const depth=d+q*(z-y+.15);return [.5+x/(2*depth*t*aspect),.5+q*(y-.15+z)/(2*depth*t)];};
 const corners=[];for(const a of [-5.1,5.1])for(const b of [-5.1,5.1])for(const c of [-.22,.36])corners.push([a,c,b]);
 let lo=10,hi=100;for(let n=0;n<18;n++){const d=(lo+hi)/2,fit=corners.every(c=>project(...c,d).every(v=>v>=.035&&v<=.965));if(fit)hi=d;else lo=d;}
 const ys=corners.map(c=>project(...c,hi)[1]),offset=.5-(Math.min(...ys)+Math.max(...ys))/2;
 const uv=project(x,y,z,hi);uv[1]+=offset;return uv;
}
