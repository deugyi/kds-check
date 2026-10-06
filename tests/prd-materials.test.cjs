const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRD=require('../prd.js');const M=require('../prd-materials.js');
const source={file:'materials.xlsx',sheet:'A1',row:8};
test('source fields stay literal, validate dates, and distinguish placement from casting',()=>{
 const d={schema:1,source,fields:[{id:'column_spec',group:'자재',label:'기둥 규격',value:'<img onerror="bad">',cell:'M8'},
 {id:'inserted',group:'일정',label:'근입일',value:'01월 12일',date:'2026-01-12',qualifier:'연도 추정: 2026년'},
 {id:'delivered',group:'일정',label:'현장 반입일',value:'bad',date:'2026-02-30'},
 {id:'weight',group:'자재',label:'중량',value:35.800000000000004}],issues:[{kind:'기존 날짜 불일치',source:'<script>bad</script>',existing:'2026-01-22',action:'기존 날짜 유지'}]};
 const clean=M.read(d);assert.equal(clean.fields[1].date,'2026-01-12');assert.equal(clean.fields[2].date,undefined);assert.equal(M.display(clean.fields[3]),'35.8');
 const html=M.render(clean);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);assert.match(html,/연도 추정/);assert.match(html,/타설일.*별도로/);assert.match(html,/확인 사항 1건/);
 assert.equal(M.render(null),'');assert.equal(M.read({schema:2,source,fields:[]}),null);
});
