// Mirror of src/utils/vatRr.ts pure logic — verifies spec §5 + §6 test tables.
const roundHalfUp = (x) => Math.floor(x + 0.5);
const flatRateGr = (net, pct = 7) => roundHalfUp((net * pct) / 100);

const JEDNOSTKI = ['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć'];
const NASTKI = ['dziesięć','jedenaście','dwanaście','trzynaście','czternaście','piętnaście','szesnaście','siedemnaście','osiemnaście','dziewiętnaście'];
const DZIESIATKI = ['','','dwadzieścia','trzydzieści','czterdzieści','pięćdziesiąt','sześćdziesiąt','siedemdziesiąt','osiemdziesiąt','dziewięćdziesiąt'];
const SETKI = ['','sto','dwieście','trzysta','czterysta','pięćset','sześćset','siedemset','osiemset','dziewięćset'];
const GRUPY = [['','',''],['tysiąc','tysiące','tysięcy'],['milion','miliony','milionów'],['miliard','miliardy','miliardów']];
const ZLOTY = ['złoty','złote','złotych'];

function pluralIndex(n){ if(n===1) return 0; const last=n%10, lastTwo=n%100; if(last>=2&&last<=4&&!(lastTwo>=12&&lastTwo<=14)) return 1; return 2; }
function three(n){ const p=[]; const s=Math.floor(n/100); if(s)p.push(SETKI[s]); const r=n%100;
  if(r>=20){p.push(DZIESIATKI[Math.floor(r/10)]); if(r%10)p.push(JEDNOSTKI[r%10]);}
  else if(r>=10)p.push(NASTKI[r-10]); else if(r>=1)p.push(JEDNOSTKI[r]); return p.join(' '); }
function integerToWords(n){ if(n===0)return JEDNOSTKI[0]; const g=[]; let x=n; while(x>0){g.push(x%1000);x=Math.floor(x/1000);}
  const out=[]; for(let i=g.length-1;i>=0;i--){ if(g[i]===0)continue; out.push(three(g[i])); if(i>0)out.push(GRUPY[i][pluralIndex(g[i])]); } return out.join(' '); }
function kwotaSlownie(totalGr){ const zl=Math.floor(totalGr/100), gr=totalGr%100; return `${integerToWords(zl)} ${ZLOTY[pluralIndex(zl)]} ${String(gr).padStart(2,'0')}/100`; }

let pass=0, fail=0;
const eq=(got,exp,label)=>{ if(got===exp){pass++;} else {fail++; console.log(`  ✗ ${label}\n     got: ${got}\n     exp: ${exp}`);} };

// §5 arytmetyka
console.log('§5 Arytmetyka groszowa:');
for(const [net,zwrot,brutto] of [[100000,7000,107000],[1,0,1],[7,0,7],[8,1,9],[4550,319,4869],[123456,8642,132098]]){
  const f=flatRateGr(net); eq(f,zwrot,`net ${net} → zwrot`); eq(net+f,brutto,`net ${net} → brutto`);
}
// §6 kwota słownie (kwoty w groszach)
console.log('§6 Kwota słownie:');
const cases=[[0,'zero złotych 00/100'],[100,'jeden złoty 00/100'],[200,'dwa złote 00/100'],[500,'pięć złotych 00/100'],
  [1100,'jedenaście złotych 00/100'],[1200,'dwanaście złotych 00/100'],[2100,'dwadzieścia jeden złotych 00/100'],
  [2200,'dwadzieścia dwa złote 00/100'],[7000,'siedemdziesiąt złotych 00/100'],[107000,'jeden tysiąc siedemdziesiąt złotych 00/100'],
  [123456,'jeden tysiąc dwieście trzydzieści cztery złote 56/100'],[200000001,'dwa miliony złotych 01/100']];
for(const [gr,exp] of cases) eq(kwotaSlownie(gr),exp,`${gr}gr`);
// bonus: pełny przykład z §12 (135,00 net → 9,45 zwrot → 144,45 brutto)
console.log('§12 przykład end-to-end:');
const net=13500, f=flatRateGr(net); eq(f,945,'zwrot 9,45'); eq(net+f,14445,'brutto 144,45');
eq(kwotaSlownie(14445),'sto czterdzieści cztery złote 45/100','słownie brutto');
eq(kwotaSlownie(945),'dziewięć złotych 45/100','słownie zwrot');

console.log(`\n${fail===0?'✅ WSZYSTKO ZIELONE':'❌ SĄ BŁĘDY'} — pass ${pass}, fail ${fail}`);
process.exit(fail===0?0:1);
