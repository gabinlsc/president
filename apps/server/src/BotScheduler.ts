import { chooseBotAction, applyBotAction } from '../../../packages/game/src/Bot';
import type { Room, RoomManager } from './RoomManager';
export class BotScheduler {
  private timers=new Map<string,ReturnType<typeof setTimeout>>();
  constructor(private rooms:RoomManager,private delay=850) {}
  schedule(room:Room) {
    const old=this.timers.get(room.code); if(old) clearTimeout(old); this.timers.delete(room.code);
    if(!room.game || !room.members.some(p=>p.connected && !p.bot)) return;
    const automatic=room.members.filter(p=>p.bot || !p.connected);
    const player=automatic.find(p=>room.game!.state.turn===p.id && chooseBotAction(room.game!,p.id))??automatic.find(p=>chooseBotAction(room.game!,p.id));
    if(!player) return;
    const timer=setTimeout(()=> {
      this.timers.delete(room.code);
      if(!this.rooms.rooms.has(room.code) || !room.game || (player.connected && !player.bot)) return;
      const action=chooseBotAction(room.game,player.id);
      if(action) {applyBotAction(room.game,player.id,action);this.rooms.changed(room);}
    },this.delay);
    timer.unref(); this.timers.set(room.code,timer);
  }
  close() {for(const t of this.timers.values())clearTimeout(t);this.timers.clear();}
}
