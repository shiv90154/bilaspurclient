// Written-answer tests + leaving the app. Needs the API on :3000 and the seeded demo accounts.
const B=process.env.API ?? 'http://localhost:3000/api';
const call=async(tok,m,u,b)=>{const r=await fetch(B+u,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:b?JSON.stringify(b):undefined});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
const upload=async(tok,u,buf)=>{const f=new FormData();f.append('file',new Blob([buf],{type:'image/png'}),'a.png');const r=await fetch(B+u,{method:'POST',headers:{authorization:'Bearer '+tok},body:f});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
const login=async(i,p)=>(await (await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:i,password:p,deviceId:'dev-'+i,deviceName:'t',platform:'WEB'})})).json()).accessToken;
let fail=0; const ok=(n,c,x)=>{console.log((c?'PASS':'FAIL')+' '+n+(c?'':' '+JSON.stringify(x)));if(!c)fail++};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');

const A=await login('9999999999','ChangeMe@123'), F=await login('9999999998','Demo@12345'), S=await login('9999999997','Demo@12345');
const subs=(await call(A,'GET','/subjects')).j; const topic=await call(A,'POST','/topics',{subjectId:subs[0].id,name:'W'+Date.now()}); ok('topic create',topic.s===201,topic);
const q1=await call(F,'POST','/questions',{topicId:topic.j.id,text:'MCQ',type:'SINGLE',options:[{text:'right',isCorrect:true},{text:'wrong',isCorrect:false}]});
const w1=await call(F,'POST','/questions',{topicId:topic.j.id,text:'Explain photosynthesis',type:'SUBJECTIVE',explanation:'Light + CO2 + water',options:[]});
ok('MCQ + written question created',q1.s===201&&w1.s===201&&w1.j.options.length===0,[q1,w1]);
const wBad=await call(F,'POST','/questions',{topicId:topic.j.id,text:'x',type:'SUBJECTIVE',options:[{text:'a',isCorrect:true}]}); ok('written question with options rejected',wBad.s===400,wBad);
const mBad=await call(F,'POST','/questions',{topicId:topic.j.id,text:'x',type:'SINGLE',options:[]}); ok('MCQ without options rejected',mBad.s===400,mBad);

const demo=(await call(A,'GET','/batches')).j.items.find(b=>b.name==='Demo Batch 2026');
const mkTest=async(title,maxLeaves)=>{
  const t=await call(F,'POST','/tests',{title,durationMin:30,negativeMark:1,maxLeaves});
  await call(F,'PUT',`/tests/${t.j.id}/questions`,{questions:[{questionId:q1.j.id,marks:4},{questionId:w1.j.id,marks:10}]});
  await call(F,'PUT',`/tests/${t.j.id}/batches`,{batchIds:[demo.id]});
  await call(F,'POST',`/tests/${t.j.id}/publish`);
  return t.j;
};

// ── Test 1: write + photo, leave the app too often ──
const t1=await mkTest('Written E2E',2); ok('test saved maxLeaves=2',t1.maxLeaves===2,t1);
const st=await call(S,'POST',`/my/tests/${t1.id}/start`); ok('start',st.s===201,st);
const aid=st.j.attemptId; const wq=st.j.questions.find(q=>q.id===w1.j.id); const mq=st.j.questions.find(q=>q.id===q1.j.id);
ok('paper: written question, no options, leave limit',wq.type==='SUBJECTIVE'&&wq.options.length===0&&Array.isArray(wq.images)&&st.j.test.maxLeaves===2&&st.j.leaves===0,st.j);
const right=mq.options.find(o=>o.text==='right').id;
const sv=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[{questionId:q1.j.id,selectedOptionIds:[right]},{questionId:w1.j.id,selectedOptionIds:[],textAnswer:'Plants make food'}]}); ok('save MCQ + text',sv.s===200,sv);
const b1=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[{questionId:w1.j.id,selectedOptionIds:[right]}]}); ok('option on written question rejected',b1.s===400,b1);
const b2=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[{questionId:q1.j.id,selectedOptionIds:[],textAnswer:'x'}]}); ok('text on MCQ rejected',b2.s===400,b2);
const big=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[{questionId:w1.j.id,selectedOptionIds:[],textAnswer:'x'.repeat(5001)}]}); ok('text over 5000 chars rejected',big.s===400,big);
const up=await upload(S,`/attempts/${aid}/answers/${w1.j.id}/images`,PNG); ok('photo upload',up.s===201&&up.j.images.length===1,up);
const upBad=await upload(S,`/attempts/${aid}/answers/${q1.j.id}/images`,PNG); ok('photo on MCQ rejected',upBad.s===400,upBad);
const notImg=await upload(S,`/attempts/${aid}/answers/${w1.j.id}/images`,Buffer.from('hello world, not an image')); ok('non-image rejected',notImg.s===415,notImg);
const up2=await upload(S,`/attempts/${aid}/answers/${w1.j.id}/images`,PNG);
const rm=await call(S,'DELETE',`/attempts/${aid}/answers/${w1.j.id}/images/${up2.j.images[1].id}`); ok('photo remove',rm.s===200&&rm.j.images.length===1,rm);
const txtKept=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[{questionId:w1.j.id,selectedOptionIds:[],markedForReview:true}]});
const p2=await call(S,'GET',`/attempts/${aid}`); const wq2=p2.j.questions.find(q=>q.id===w1.j.id);
ok('text + photo kept after a mark-for-review save',txtKept.s===200&&wq2.textAnswer==='Plants make food'&&wq2.images.length===1,wq2);

const l1=await call(S,'POST',`/attempts/${aid}/background`); const l2=await call(S,'POST',`/attempts/${aid}/background`);
ok('leave 1 and 2 are warnings',l1.j.leaves===1&&!l1.j.submitted&&l2.j.leaves===2&&!l2.j.submitted&&l2.j.maxLeaves===2,[l1.j,l2.j]);
const l3=await call(S,'POST',`/attempts/${aid}/background`); ok('leave 3 auto-submits',l3.j.submitted===true,l3.j);
const late=await call(S,'PUT',`/attempts/${aid}/answers`,{answers:[]}); ok('save after auto-submit blocked',late.s===409,late);
const r1=await call(S,'GET',`/attempts/${aid}/result`); ok('result pending, no score',r1.s===200&&r1.j.evaluation==='PENDING'&&r1.j.score===undefined&&r1.j.endReason==='LEFT_APP',r1.j);
const lst=(await call(S,'GET','/my/tests')).j.find(x=>x.id===t1.id); ok('test list hides the MCQ-only score',lst.attempt.score===null&&lst.writtenQuestions===1,lst);

const lb=await call(F,'GET',`/tests/${t1.id}/results`); const row=lb.j.rows.find(r=>r.attemptId===aid);
ok('leaderboard: pending, LEFT_APP, no rank',row.evaluation==='PENDING'&&row.endReason==='LEFT_APP'&&row.rank===null&&lb.j.summary.toCheck===1&&row.backgroundHits===3,lb.j);
const sh=await call(F,'GET',`/tests/${t1.id}/attempts/${aid}`); ok('answer sheet',sh.s===200&&sh.j.questions.length===1&&sh.j.questions[0].textAnswer==='Plants make food'&&sh.j.questions[0].images.length===1&&sh.j.questions[0].modelAnswer==='Light + CO2 + water',sh.j);
const sS=await call(S,'GET',`/tests/${t1.id}/attempts/${aid}`); ok('student cannot open answer sheet',sS.s===403,sS);
const over=await call(F,'PUT',`/tests/${t1.id}/attempts/${aid}/marks`,{marks:[{questionId:w1.j.id,awarded:11}],done:true}); ok('marks over max rejected',over.s===400,over);
const none=await call(F,'PUT',`/tests/${t1.id}/attempts/${aid}/marks`,{marks:[],done:true}); ok('finish without marks rejected',none.s===400,none);
const draft=await call(F,'PUT',`/tests/${t1.id}/attempts/${aid}/marks`,{marks:[{questionId:w1.j.id,awarded:7,feedback:'Good'}],done:false}); ok('save marks draft',draft.s===200&&draft.j.attempt.evaluation==='PENDING',draft.j);
const done=await call(F,'PUT',`/tests/${t1.id}/attempts/${aid}/marks`,{marks:[{questionId:w1.j.id,awarded:7.5,feedback:'Good'}],done:true}); ok('finish checking',done.s===200&&done.j.attempt.evaluation==='DONE',done.j);
const r2=await call(S,'GET',`/attempts/${aid}/result`); ok('result 4 + 7.5 = 11.5, ranked',r2.j.evaluation==='DONE'&&r2.j.score===11.5&&r2.j.rank===1,r2.j);
await call(F,'POST',`/tests/${t1.id}/close`);
const r3=await call(S,'GET',`/attempts/${aid}/result`); const rw=r3.j.review?.find(r=>r.questionId===w1.j.id);
ok('review shows answer, marks and feedback',rw&&rw.textAnswer==='Plants make food'&&rw.awardedMarks===7.5&&rw.feedback==='Good'&&rw.images.length===1,r3.j);

// ── Test 2: written question left blank, limit off ──
const t2=await mkTest('Written blank E2E',0);
const s2=await call(S,'POST',`/my/tests/${t2.id}/start`); const a2=s2.j.attemptId;
for(let i=0;i<5;i++) await call(S,'POST',`/attempts/${a2}/background`);
const l5=await call(S,'POST',`/attempts/${a2}/background`); ok('limit 0: only counts',l5.j.submitted===false&&l5.j.leaves===6,l5.j);
const sub2=await call(S,'POST',`/attempts/${a2}/submit`); ok('blank written answer: no checking needed',sub2.j.evaluation==='AUTO'&&sub2.j.score===0&&sub2.j.endReason==='SUBMIT',sub2.j);
const nm=await call(F,'PUT',`/tests/${t2.id}/attempts/${a2}/marks`,{marks:[],done:true}); ok('marks on attempt with nothing to check rejected',nm.s===409,nm);
await call(F,'POST',`/tests/${t2.id}/close`);

console.log(fail?`\n${fail} FAILED`:'\nALL PASSED'); process.exit(fail?1:0);
