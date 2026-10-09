import type { Card, Rank, Role, Suit, Table } from '@president/shared';

export interface Player { id: string; name: string; hand: Card[]; role: Role }
export interface GameState {
  players: Player[]; phase: 'playing' | 'exchange' | 'finished';
  table: Table | null; turn: string | null; direction: 1 | -1;
  round: number; opening: boolean; passed: string[];
  finishOrder: string[]; penalized: string[]; ranking: string[];
  exchanges: Record<string, string[]>; log: string[];
}
export class RuleError extends Error {}
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new RuleError(message); }
export const sortHand = (cards: Card[]): Card[] => [...cards].sort((a,b) => a.rank-b.rank || a.id.localeCompare(b.id));
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ['hearts','spades','diamonds','clubs'] as Suit[]) {
    for (let rank = 3; rank <= 15; rank++) deck.push({id:`${rank}-${suit}`,rank:rank as Rank,suit});
  }
  return deck;
}
export function shuffle(deck: Card[], random: () => number = Math.random): Card[] {
  const result = [...deck];
  for (let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j]!,result[i]!]; }
  return result;
}
export class GameEngine {
  state: GameState;
  constructor(players: {id:string;name:string}[], random: () => number = Math.random) {
    requireRule(players.length>=2 && players.length<=9,'La table accueille de 2 à 9 joueurs.');
    requireRule(new Set(players.map(p=>p.id)).size===players.length,'Identifiants de joueurs dupliqués.');
    this.state={players:players.map(p=>({...p,hand:[],role:'neutral'})),phase:'playing',table:null,turn:null,direction:1,round:1,opening:true,passed:[],finishOrder:[],penalized:[],ranking:[],exchanges:{},log:[]};
    this.deal(random);
    this.state.turn=this.state.players.find(p=>p.hand.some(c=>c.rank===12 && c.suit==='hearts'))!.id;
    this.note('La Dame de cœur ouvre le bal.');
  }
  private note(message: string) { this.state.log=[...this.state.log.slice(-19),message]; }
  player(id: string): Player { const p=this.state.players.find(p=>p.id===id); requireRule(p,'Joueur inconnu.'); return p; }
  private deal(random: () => number) {
    this.state.players.forEach(p=>p.hand=[]);
    shuffle(makeDeck(),random).forEach((card,i)=>this.state.players[i%this.state.players.length]!.hand.push(card));
    this.state.players.forEach(p=>p.hand=sortHand(p.hand));
  }
  private next(from: string, includePassed = false): string | null {
    const s=this.state, start=s.players.findIndex(p=>p.id===from);
    for(let step=1;step<=s.players.length;step++) {
      const p=s.players[(start+step*s.direction+s.players.length*2)%s.players.length]!;
      if(p.hand.length && (includePassed || !s.passed.includes(p.id))) return p.id;
    }
    return null;
  }
  private cards(id: string, ids: string[]): Card[] {
    requireRule(Array.isArray(ids) && ids.length>0 && ids.length<=4 && ids.every(x=>typeof x==='string') && new Set(ids).size===ids.length,'Sélection de cartes invalide.');
    const p=this.player(id), cards=ids.map(cardId=>p.hand.find(c=>c.id===cardId));
    requireRule(cards.every(Boolean),'Ces cartes ne sont pas dans votre main.');
    return cards as Card[];
  }
  isCut(id: string, ids: string[]): boolean {
    try {
      const cards=this.cards(id,ids), t=this.state.table;
      return !!t && t.format!==3 && t.run.length+cards.length===4 && cards.every(c=>c.rank===t.rank);
    } catch { return false; }
  }
  validatePlay(id: string, ids: string[]): Card[] {
    const s=this.state;
    requireRule(s.phase==='playing','La manche n’est pas en cours.');
    const cards=this.cards(id,ids), rank=cards[0]!.rank;
    requireRule(cards.every(c=>c.rank===rank),'Jouez des cartes de même valeur.');
    const cut=this.isCut(id,ids);
    if(!cut) {
      requireRule(s.turn===id,'Ce n’est pas votre tour.');
      requireRule(!s.passed.includes(id),'Vous avez déjà passé sur ce pli.');
      requireRule(cards.length<=3,'Un carré se complète sur la table.');
      if(s.table) {
        requireRule(cards.length===s.table.format,'Respectez le format du pli.');
        requireRule(s.table.equalRequired ? rank===s.table.rank : rank>=s.table.rank,s.table.equalRequired?'Jouez la même valeur ou passez.':'Jouez une valeur supérieure ou égale.');
      }
    }
    if(s.opening) requireRule(cards.some(c=>c.rank===12 && c.suit==='hearts'),'La première pose doit contenir la Dame de cœur.');
    return cards;
  }
  play(id: string, ids: string[]): void {
    const cards=this.validatePlay(id,ids), s=this.state, p=this.player(id), t=s.table;
    const rank=cards[0]!.rank, cut=this.isCut(id,ids);
    p.hand=p.hand.filter(c=>!ids.includes(c.id)); s.opening=false;
    if(cards.some(c=>c.rank===12 && c.suit==='spades')) { s.direction=s.direction===1?-1:1; this.note('La Dame de pique inverse le sens.'); }
    this.note(`${p.name} pose ${cards.length} carte${cards.length>1?'s':''}.`);
    if(!p.hand.length) {
      if(rank===15) { s.penalized.push(id); this.note(`${p.name} finit sur un 2 : pénalité !`); }
      else s.finishOrder.push(id);
      this.clear(this.next(id,true));
      this.finishIfNeeded(); return;
    }
    if(cut || rank===15) { this.note(cut?`${p.name} complète le carré !`:'Le 2 nettoie la table.'); this.clear(id); return; }
    const same=t?.rank===rank;
    s.table={cards,format:t?.format??cards.length,rank,owner:id,equalRequired:!!same,run:same?[...t.run,...cards]:[...cards]};
    // A normal on-turn play may also complete a square, but triples never cut.
    if(s.table.format!==3 && s.table.run.length===4) { this.note('Carré complet : table nettoyée.'); this.clear(id); return; }
    s.turn=this.next(id);
    if(s.turn===id || s.turn===null) this.clear(id);
  }
  pass(id: string): void {
    const s=this.state;
    requireRule(s.phase==='playing' && s.turn===id,'Ce n’est pas votre tour.');
    requireRule(s.table && !s.opening,'Vous devez ouvrir le pli.');
    s.table.equalRequired=false;
    if(!s.passed.includes(id)) s.passed.push(id);
    this.note(`${this.player(id).name} passe.`);
    const next=this.next(id);
    if(!next || next===s.table.owner) this.clear(s.table.owner);
    else s.turn=next;
  }
  private clear(leader: string | null) { this.state.table=null; this.state.passed=[]; this.state.turn=leader; }
  private finishIfNeeded() {
    const s=this.state, active=s.players.filter(p=>p.hand.length);
    if(active.length>1) return;
    s.ranking=[...s.finishOrder,...active.map(p=>p.id),...s.penalized];
    s.phase='finished'; s.turn=null;
    const n=s.ranking.length;
    s.players.forEach(p=> {
      const i=s.ranking.indexOf(p.id);
      p.role=i===0?'president':i===n-1?'trouduc':n>=4 && i===1?'vice-president':n>=4 && i===n-2?'vice-trouduc':'neutral';
    });
    this.note(`${this.player(s.ranking[0]!).name} devient Président.`);
  }
  nextRound(random: () => number = Math.random): void {
    const s=this.state;
    requireRule(s.phase==='finished','Terminez la manche avant de redistribuer.');
    this.deal(random); s.round++; s.phase='exchange'; s.opening=false; s.finishOrder=[]; s.penalized=[]; s.exchanges={}; s.direction=1; this.clear(null);
    // Mandatory contributions are reserved from the initial deal, before any transfer.
    for(const p of s.players) {
      const count=p.role==='trouduc'?2:p.role==='vice-trouduc'?1:0;
      if(count) s.exchanges[p.id]=sortHand(p.hand).slice(-count).map(c=>c.id);
    }
    this.note('Nouvelle donne : choisissez les cartes à échanger.');
  }
  exchangeCount(id: string): number { const role=this.player(id).role; return role==='president'?2:role==='vice-president'?1:0; }
  exchange(id: string, ids: string[]): void {
    const s=this.state;
    requireRule(s.phase==='exchange','Aucun échange en cours.');
    const count=this.exchangeCount(id);
    requireRule(count>0 && ids.length===count,'Nombre de cartes à donner incorrect.');
    requireRule(!s.exchanges[id],'Échange déjà validé.');
    this.cards(id,ids); s.exchanges[id]=[...ids];
    const donors=s.players.filter(p=>this.exchangeCount(p.id)>0);
    if(!donors.every(p=>s.exchanges[p.id])) return;
    const transfers: {from:Player;to:Player;cards:Card[]}[]=[];
    for(const [a,b] of [['president','trouduc'],['vice-president','vice-trouduc']] as [Role,Role][]) {
      const pa=s.players.find(p=>p.role===a), pb=s.players.find(p=>p.role===b);
      if(!pa || !pb) continue;
      transfers.push({from:pa,to:pb,cards:this.cards(pa.id,s.exchanges[pa.id]!)},{from:pb,to:pa,cards:this.cards(pb.id,s.exchanges[pb.id]!)});
    }
    for(const t of transfers) t.from.hand=t.from.hand.filter(c=>!t.cards.some(g=>g.id===c.id));
    for(const t of transfers) t.to.hand=sortHand([...t.to.hand,...t.cards]);
    s.phase='playing'; s.turn=s.players.find(p=>p.role==='trouduc')!.id;
    this.note('Échanges terminés. Le Trou du cul ouvre.');
  }
  legalMoves(id: string): string[][] {
    const s=this.state, p=this.player(id), groups=new Map<Rank,Card[]>(), moves:string[][]=[];
    if(s.phase!=='playing' || !p.hand.length) return moves;
    for(const c of p.hand) groups.set(c.rank,[...(groups.get(c.rank)??[]),c]);
    for(const cards of groups.values()) {
      // Enumerate combinations: the opening Queen and spade Queen cannot be lost in a slice.
      for(let mask=1;mask<(1<<cards.length);mask++) {
        const ids=cards.filter((_,i)=>mask&(1<<i)).map(c=>c.id);
        try { this.validatePlay(id,ids); moves.push(ids); } catch { /* illegal candidate */ }
      }
    }
    return moves;
  }
}
