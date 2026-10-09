import { describe, it, expect } from 'vitest';
import { GameEngine, makeDeck } from '../packages/game/src/GameEngine';
import type { Card, Rank, Suit } from '@president/shared';
const c=(rank:Rank,suit:Suit='clubs'):Card=>({id:`${rank}-${suit}`,rank,suit});
function rig(hands:Card[][]) {
  const g=new GameEngine(hands.map((_,i)=>({id:String(i),name:`J${i}`})));
  g.state.players.forEach((p,i)=>p.hand=hands[i]!); g.state.opening=false; g.state.turn='0'; return g;
}
describe('Moteur autoritaire',()=> {
  it('distribue exactement 52 cartes et ouvre avec la Dame de cœur',()=> {
    for(const n of [2,4,9]) { const g=new GameEngine(Array.from({length:n},(_,i)=>({id:String(i),name:'J'}))); expect(new Set(g.state.players.flatMap(p=>p.hand.map(c=>c.id))).size).toBe(52); expect(g.player(g.state.turn!).hand.some(c=>c.id==='12-hearts')).toBe(true); expect(()=>g.pass(g.state.turn!)).toThrow(); }
    expect(makeDeck()).toHaveLength(52);
  });
  it('refuse une ouverture sans Dame de cœur, même hors tour',()=> {
    const g=rig([[c(12,'hearts'),c(3)],[c(4)]]); g.state.opening=true;
    expect(()=>g.play('0',['3-clubs'])).toThrow(/Dame/); g.play('0',['12-hearts']); expect(g.state.opening).toBe(false);
  });
  it('refuse cartes étrangères, doublons et valeurs mélangées sans muter',()=> {
    const g=rig([[c(3),c(4)],[c(5)]]), before=JSON.stringify(g.state);
    for(const ids of [['5-clubs'],['3-clubs','3-clubs'],['3-clubs','4-clubs']]) expect(()=>g.play('0',ids)).toThrow();
    expect(JSON.stringify(g.state)).toBe(before);
  });
  it('impose les paires et la valeur minimale, y compris pour le 2',()=> {
    const g=rig([[c(6),c(6,'hearts'),c(9)],[c(5),c(15),c(7),c(7,'hearts')]]);
    g.play('0',['6-clubs','6-hearts']); expect(()=>g.play('1',['15-clubs'])).toThrow(/format/); expect(()=>g.play('1',['5-clubs'])).toThrow(); g.play('1',['7-clubs','7-hearts']); expect(g.state.table?.format).toBe(2);
  });
  it('propage les égalités et lève la contrainte après une passe',()=> {
    const g=rig([[c(6),c(9)],[c(6,'hearts'),c(10)],[c(6,'spades'),c(7)],[c(8),c(11)]]);
    g.play('0',['6-clubs']); g.play('1',['6-hearts']); expect(()=>g.play('2',['7-clubs'])).toThrow(/même/);
    g.play('2',['6-spades']); expect(g.state.table?.equalRequired).toBe(true); g.pass('3'); expect(g.state.table?.equalRequired).toBe(false); g.play('0',['9-clubs']); expect(g.state.table).toBeNull();
  });
  it('le 2 nettoie le pli et donne la main à son auteur',()=> {
    const g=rig([[c(3),c(4)],[c(15),c(5)],[c(6)]]); g.play('0',['3-clubs']); g.play('1',['15-clubs']); expect(g.state.table).toBeNull(); expect(g.state.turn).toBe('1');
  });
  it('la Dame de pique inverse immédiatement le sens',()=> {
    const g=rig([[c(12,'spades'),c(3)],[c(13)],[c(14)]]); g.play('0',['12-spades']); expect(g.state.direction).toBe(-1); expect(g.state.turn).toBe('2');
  });
  it('autorise la coupe hors tour pour compléter un carré',()=> {
    const g=rig([[c(6),c(9)],[c(10)],[c(6,'hearts'),c(6,'diamonds'),c(6,'spades'),c(7)]]);
    g.play('0',['6-clubs']); g.play('2',['6-hearts','6-diamonds','6-spades']); expect(g.state.table).toBeNull(); expect(g.state.turn).toBe('2');
  });
  it('interdit toute coupe sur un pli en triples',()=> {
    const g=rig([[c(6),c(6,'hearts'),c(6,'diamonds'),c(9)],[c(10)],[c(6,'spades'),c(7)]]);
    g.play('0',['6-clubs','6-hearts','6-diamonds']); expect(()=>g.play('2',['6-spades'])).toThrow(); expect(g.isCut('2',['6-spades'])).toBe(false);
  });
  it('nettoie immédiatement sur une sortie et fait relancer le voisin',()=> {
    const g=rig([[c(3)],[c(4),c(5)],[c(6),c(7)]]); g.play('0',['3-clubs']); expect(g.state.table).toBeNull(); expect(g.state.turn).toBe('1'); expect(g.state.finishOrder).toEqual(['0']);
  });
  it('punit une sortie sur le 2, même en premier',()=> {
    const g=rig([[c(15)],[c(3)],[c(4)]]); g.play('0',['15-clubs']); g.play('1',['3-clubs']); expect(g.state.ranking).toEqual(['1','2','0']); expect(g.player('0').role).toBe('trouduc');
  });
  it('tout le monde passe : le dernier poseur relance',()=> {
    const g=rig([[c(3),c(7)],[c(4)],[c(5)]]); g.play('0',['3-clubs']); g.pass('1'); g.pass('2'); expect(g.state.table).toBeNull(); expect(g.state.turn).toBe('0');
  });
  it('échanges simultanés : meilleurs imposés, choix libres, 52 cartes préservées',()=> {
    const g=rig([[c(3)],[c(4)],[c(5)],[c(6)]]); g.play('0',['3-clubs']); g.play('1',['4-clubs']); g.play('2',['5-clubs']); g.nextRound(()=>0.42);
    const worst=g.player('3'), viceWorst=g.player('2'), bestBefore=[...worst.hand].sort((a,b)=>a.rank-b.rank).slice(-2).map(c=>c.id), viceBest=Math.max(...viceWorst.hand.map(c=>c.rank));
    expect(g.state.exchanges['3']).toEqual(bestBefore);
    const give=g.player('0').hand.slice(-2).map(c=>c.id); g.exchange('0',give); expect(g.state.phase).toBe('exchange'); expect(()=>g.exchange('0',give)).toThrow();
    g.exchange('1',g.player('1').hand.slice(0,1).map(c=>c.id)); expect(g.state.phase).toBe('playing'); expect(g.state.turn).toBe('3'); expect(g.player('0').hand.map(c=>c.id)).toEqual(expect.arrayContaining(bestBefore)); expect(g.player('1').hand.some(c=>c.rank===viceBest)).toBe(true); expect(new Set(g.state.players.flatMap(p=>p.hand.map(c=>c.id))).size).toBe(52);
  });
  it('le duel a seulement deux rôles et un échange de deux cartes',()=> {
    const g=rig([[c(3)],[c(4)]]); g.play('0',['3-clubs']); expect(g.player('1').role).toBe('trouduc'); g.nextRound(); g.exchange('0',g.player('0').hand.slice(0,2).map(c=>c.id)); expect(g.state.phase).toBe('playing');
  });
});
