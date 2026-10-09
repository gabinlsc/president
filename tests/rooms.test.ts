import { describe,it,expect,afterEach } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createAppServer } from '../apps/server/src/server';
import { RoomManager } from '../apps/server/src/RoomManager';
import type { RoomView, Session, Reply } from '@president/shared';
const clients:Socket[]=[];
const servers:ReturnType<typeof createAppServer>[]=[];
afterEach(async()=>{clients.forEach(c=>c.disconnect());clients.length=0;await Promise.all(servers.splice(0).map(s=>s.close()));});
async function setup() {
  const server=createAppServer();servers.push(server); await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  async function client() {const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>((r,j)=>{s.on('connect',r);s.on('connect_error',j);});return s;}
  return {server,url,client};
}
const ack=(s:Socket,event:string,data?:unknown):Promise<{ok:boolean;data?:Session;error?:string}>=>new Promise((resolve,reject)=>{s.timeout(2000).emit(event,...(data===undefined?[]:[data]),(err:Error,r:Reply<Session>)=>err?reject(err):resolve(r));});
const state=(s:Socket):Promise<RoomView>=>new Promise(r=>s.once('room:state',r));
describe('Contrat salons Socket.IO',()=> {
  it('health et routes inconnues respectent le contrat HTTP',async()=>{const {url}=await setup();expect(await (await fetch(url+'/health')).json()).toEqual({status:'ok'});expect((await fetch(url+'/missing')).status).toBe(404);});
  it('deux clients jouent avec des mains privées; seul l’hôte démarre',async()=> {
    const {client}=await setup(),a=await client(),b=await client();
    const created=await ack(a,'room:create',{name:'Alice',mode:'online'});expect(created.ok).toBe(true);const session=created.data as Session;
    expect((await ack(a,'room:start')).ok).toBe(false);
    expect((await ack(b,'room:join',{name:'Bob',code:session.code.toLowerCase()})).ok).toBe(true);
    expect((await ack(b,'room:start')).ok).toBe(false);
    const sa=state(a),sb=state(b);expect((await ack(a,'room:start')).ok).toBe(true);
    const [va,vb]=await Promise.all([sa,sb]);expect(va.hand).toHaveLength(26);expect(vb.hand).toHaveLength(26);expect(va.hand.some(c=>vb.hand.some(d=>d.id===c.id))).toBe(false);expect(va.players.every(p=>!('hand' in p)&&!('token' in p))).toBe(true);
    const mover=va.turn===va.selfId?a:b, v=mover===a?va:vb;
    expect((await ack(mover,'game:play',{cards:[v.hand.find(c=>c.id==='12-hearts')!.id]})).ok).toBe(true);
    expect((await ack(mover,'game:play',{cards:[v.hand[0]!.id]})).ok).toBe(false);
    expect((await ack(await client(),'room:join',{name:'Late',code:session.code})).ok).toBe(false);
  });
  it('reconnexion par jeton récupère exactement la même identité',async()=> {
    const {client}=await setup(),a=await client();const r=await ack(a,'room:create',{name:'Alice',mode:'online'});const session=r.data as Session;
    a.disconnect();const b=await client();const view=state(b),resumed=await ack(b,'session:resume',{token:session.token});expect(resumed.data).toEqual(session);expect((await view).selfId).toBe(session.playerId);
    expect((await ack(await client(),'session:resume',{token:'fake'})).ok).toBe(false);
  });
  it('une reprise active évince l’ancienne socket et le départ révoque le jeton',async()=> {
    const {client}=await setup(),a=await client();const session=(await ack(a,'room:create',{name:'Alice',mode:'online'})).data as Session;
    const b=await client();expect((await ack(b,'session:resume',{token:session.token})).ok).toBe(true);expect((await ack(b,'room:leave')).ok).toBe(true);
    const c=await client();expect((await ack(c,'session:resume',{token:session.token})).ok).toBe(false);
  });
  it('limite les salons à 8 humains et nettoie les sessions abandonnées',()=> {
    const m=new RoomManager(),s=m.create({name:'Host',mode:'online'},'0');
    for(let i=1;i<8;i++)m.join({code:s.code,name:`J${i}`},String(i));expect(()=>m.join({code:s.code,name:'9'},'9')).toThrow(/complète/);
    for(const p of m.rooms.get(s.code)!.members)m.disconnect(p.token,p.socketId!);
    m.cleanup(Date.now()+31*60*1000);expect(m.rooms.size).toBe(0);expect(m.sessions.size).toBe(0);
  });
  it('rejette les pseudos et messages malformés sans arrêter le serveur',async()=> {
    const {client}=await setup(),a=await client();expect((await ack(a,'room:create',null)).ok).toBe(false);expect((await ack(a,'room:create',{name:'',mode:'online'})).ok).toBe(false);expect((await ack(a,'room:create',{name:'OK',mode:'online'})).ok).toBe(true);
  });
});
