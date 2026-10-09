import { describe,it,expect } from 'vitest';
import { GameEngine } from '../packages/game/src/GameEngine';
import { chooseBotAction,applyBotAction } from '../packages/game/src/Bot';
import { RoomManager } from '../apps/server/src/RoomManager';
function seeded(seed:number) {let x=seed;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
describe('Bots',()=> {
  it('termine 48 manches déterministes à 2, 5, 8 et 9 joueurs sans blocage ni perte de cartes',()=> {
    for(const count of [2,5,8,9])for(let seed=1;seed<=6;seed++) {
      const random=seeded(seed),g=new GameEngine(Array.from({length:count},(_,i)=>({id:String(i),name:`Bot${i}`})),random);
      for(let round=0;round<2;round++) {
        let steps=0;
        while(g.state.phase!=='finished' && steps++<1500) {
          const id=g.state.phase==='exchange'?g.state.players.find(p=>g.exchangeCount(p.id)>0 && !g.state.exchanges[p.id])!.id:g.state.turn!;
          const action=chooseBotAction(g,id);expect(action).not.toBeNull();applyBotAction(g,id,action!);
          const held=g.state.players.flatMap(p=>p.hand.map(c=>c.id));expect(new Set(held).size).toBe(held.length);
        }
        expect(steps).toBeLessThan(1500);expect(new Set(g.state.ranking).size).toBe(count);g.nextRound(random);
        expect(g.state.players.flatMap(p=>p.hand)).toHaveLength(52);
      }
    }
  });
  it('valide 4–8 bots et lance immédiatement une table solo',()=> {
    const m=new RoomManager();for(const n of [3,9,4.5,undefined])expect(()=>m.create({name:'Moi',mode:'solo',bots:n},'s')).toThrow();
    for(const n of [4,8]){const s=m.create({name:'Moi',mode:'solo',bots:n},'s'),room=m.rooms.get(s.code)!;expect(room.members.filter(p=>p.bot)).toHaveLength(n);expect(room.game?.state.phase).toBe('playing');}
  });
  it('coupe hors tour et préfère une sortie sans 2',()=> {
    const g=new GameEngine([{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}]);g.state.opening=false;g.state.turn='a';
    g.player('a').hand=[{id:'6-clubs',rank:6,suit:'clubs'},{id:'9-clubs',rank:9,suit:'clubs'}];
    g.player('c').hand=['hearts','diamonds','spades'].map(suit=>({id:`6-${suit}`,rank:6,suit:suit as 'hearts'}));
    g.play('a',['6-clubs']);expect(chooseBotAction(g,'c')?.type).toBe('play');
  });
});
