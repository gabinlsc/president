import { randomBytes, randomUUID } from 'node:crypto';
import type { RoomView, Session } from '@president/shared';
import { GameEngine } from '../../../packages/game/src/GameEngine';

export interface Member { id:string; name:string; bot:boolean; connected:boolean; socketId:string|null; token:string|null }
export interface Room { code:string; mode:'online'|'solo'; hostId:string; members:Member[]; game:GameEngine|null; touched:number }
export class RoomManager {
  readonly rooms=new Map<string,Room>();
  readonly sessions=new Map<string,{code:string;playerId:string}>();
  onChange: (room:Room)=>void = ()=>{};
  private name(value: unknown): string {
    if(typeof value!=='string' || !value.trim() || value.trim().length>24 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Choisissez un pseudo de 1 à 24 caractères.');
    return value.trim();
  }
  private member(name:string,socketId:string): Member { return {id:randomUUID(),name,bot:false,connected:true,socketId,token:randomBytes(32).toString('hex')}; }
  private session(room:Room, member:Member): Session {
    this.sessions.set(member.token!,{code:room.code,playerId:member.id});
    return {token:member.token!,playerId:member.id,code:room.code};
  }
  create(input:{name:string;mode:'online'|'solo';bots?:number},socketId:string):Session {
    if(!input || (input.mode!=='online' && input.mode!=='solo')) throw new Error('Mode de jeu invalide.');
    if(input.mode==='solo') throw new Error('Le mode solo sera disponible à la prochaine étape.');
    if(this.rooms.size>=1000) throw new Error('Le serveur est complet. Réessayez plus tard.');
    const name=this.name(input.name); let code:string;
    do { code=randomBytes(3).toString('hex').slice(0,4).toUpperCase(); } while(this.rooms.has(code));
    const member=this.member(name,socketId), room:Room={code,mode:input.mode,hostId:member.id,members:[member],game:null,touched:Date.now()};
    this.rooms.set(code,room); const session=this.session(room,member); this.changed(room); return session;
  }
  join(input:{code:string;name:string},socketId:string):Session {
    const name=this.name(input?.name);
    if(typeof input?.code!=='string') throw new Error('Code de salon invalide.');
    const room=this.rooms.get(input.code.trim().toUpperCase());
    if(!room || room.mode!=='online') throw new Error('Ce salon est introuvable.');
    if(room.game) throw new Error('Cette partie a déjà commencé.');
    if(room.members.length>=8) throw new Error('La table est complète (8 joueurs).');
    const member=this.member(name,socketId); room.members.push(member);
    const session=this.session(room,member); this.changed(room); return session;
  }
  resume(token:unknown,socketId:string): {session:Session;previousSocket:string|null} {
    if(typeof token!=='string') throw new Error('Session invalide.');
    const session=this.sessions.get(token), room=session && this.rooms.get(session.code), member=room?.members.find(p=>p.id===session?.playerId);
    if(!room || !member || !member.token) throw new Error('La session a expiré.');
    const previousSocket=member.socketId; member.socketId=socketId; member.connected=true; this.changed(room);
    return {session:this.session(room,member),previousSocket};
  }
  requireMember(token:unknown,socketId:string):{room:Room;member:Member} {
    const session=typeof token==='string' && this.sessions.get(token), room=session && this.rooms.get(session.code);
    const member=room && room.members.find(p=>p.id===session.playerId);
    if(!room || !member || member.socketId!==socketId) throw new Error('Rejoignez un salon pour jouer.');
    return {room,member};
  }
  start(room:Room,id:string) {
    if(id!==room.hostId) throw new Error('Seul l’hôte peut lancer la partie.');
    if(room.game) throw new Error('La partie est déjà lancée.');
    if(room.members.length<2) throw new Error('Il faut au moins 2 joueurs.');
    room.game=new GameEngine(room.members); this.changed(room);
  }
  next(room:Room,id:string) {
    if(id!==room.hostId) throw new Error('Seul l’hôte peut lancer la manche suivante.');
    this.requireGame(room).nextRound(); this.changed(room);
  }
  requireGame(room:Room):GameEngine { if(!room.game) throw new Error('La partie n’a pas commencé.'); return room.game; }
  changed(room:Room) { room.touched=Date.now(); this.onChange(room); }
  disconnect(token:unknown,socketId:string,leave=false) {
    let ctx; try { ctx=this.requireMember(token,socketId); } catch { return; }
    const {room,member}=ctx; member.connected=false; member.socketId=null;
    if(leave) {
      if(member.token) this.sessions.delete(member.token); member.token=null;
      if(!room.game) room.members=room.members.filter(p=>p.id!==member.id);
      else member.bot=true;
    }
    if(room.hostId===member.id) room.hostId=room.members.find(p=>p.connected && !p.bot)?.id??room.members[0]?.id??'';
    if(!room.members.length) this.rooms.delete(room.code);
    else this.changed(room);
  }
  cleanup(now=Date.now()) {
    for(const room of this.rooms.values()) {
      if(room.members.some(m=>m.connected) || now-room.touched<30*60*1000) continue;
      for(const member of room.members) if(member.token) this.sessions.delete(member.token);
      this.rooms.delete(room.code);
    }
  }
  view(room:Room,selfId:string):RoomView {
    const g=room.game, s=g?.state;
    return {code:room.code,mode:room.mode,hostId:room.hostId,selfId,phase:s?.phase??'waiting',
      players:room.members.map(m=>({id:m.id,name:m.name,bot:m.bot,connected:m.connected,count:g?.player(m.id).hand.length??0,role:g?.player(m.id).role??'neutral',finish:s?.ranking.length?s.ranking.indexOf(m.id)+1:s?.finishOrder.includes(m.id)?s.finishOrder.indexOf(m.id)+1:null})),
      hand:g?[...g.player(selfId).hand]:[],table:s?.table??null,turn:s?.turn??null,direction:s?.direction??1,round:s?.round??0,ranking:s?.ranking??[],log:s?.log??[],exchangeCount:s?.phase==='exchange'?g!.exchangeCount(selfId):0,exchangeSubmitted:!!s?.exchanges[selfId],opening:s?.opening??false};
  }
}
