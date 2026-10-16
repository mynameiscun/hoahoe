/** Step 12.4.5: Node mock tests, NO real GitHub or Sheets calls. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script/admin/Admin.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script/admin/Admin.html'), 'utf8');
const captures=[];
const props = {
  GITHUB_OWNER:'hoa-hoe-owner', GITHUB_REPO:'flower-pages',GITHUB_BRANCH:'main',
  GITHUB_TOKEN:'github_pat_fake_very_long_token_for_mock_only',
};
const ctx={
  PropertiesService:{getScriptProperties:()=>({getProperty:x=>props[x]||''})},
  Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),
    getUuid:()=> 'a1b2c3d4-e5f6-4011-aabb-123456789abc',formatDate:()=> '20261017'},
  UrlFetchApp:{fetch:(url,options)=>{
    captures.push({url,options});
    const basename='hh-20261017-a1b2c3d4e5f64011aabb123456789abc.webp';
    return {getResponseCode:()=>201,getContentText:()=>JSON.stringify({content:{path:'public/img/product/'+basename}})};
  }},
};
vm.createContext(ctx);vm.runInContext(src,ctx);
ctx.hhAuthorize_=token=>{if(token!=='session')throw Error('not authorized');};
const upload={mime:'image/webp',base64:Buffer.from('RIFF0000WEBP'+'mock data').toString('base64')};
let cases=0;
function pass(fn){fn();cases++;}
function fail(fn,re){assert.throws(fn,re);cases++;}
pass(()=>{
  const res=ctx.adminUploadProductImage('session',upload);
  assert.equal(res.ok,true);assert.equal(res.path,'img/product/hh-20261017-a1b2c3d4e5f64011aabb123456789abc.webp');
  const req=captures.at(-1);assert.ok(req.url.includes('/contents/public/img/product/'));
  assert.equal(JSON.parse(req.options.payload).branch,'main');
  assert.equal(JSON.parse(req.options.payload).content,upload.base64);
  assert.equal(req.options.headers.Authorization,'Bearer '+props.GITHUB_TOKEN);
  assert.ok(!JSON.stringify(res).includes(props.GITHUB_TOKEN));
});
fail(()=>ctx.adminUploadProductImage('bad',upload),/not authorized/);
fail(()=>ctx.adminUploadProductImage('session',{mime:'image/jpeg',base64:upload.base64}),/Định dạng tệp/);
fail(()=>ctx.adminUploadProductImage('session',{mime:'image/webp',base64:'%%%'}),/Ảnh vượt giới hạn/);
fail(()=>ctx.adminUploadProductImage('session',{mime:'image/webp',base64:'A'.repeat(3900001)}),/Ảnh vượt giới hạn/);
fail(()=>ctx.adminUploadProductImage('session',{mime:'image/gif',base64:upload.base64}),/Chỉ nhận/);
pass(()=>{
  const existing=props.GITHUB_UPLOAD_PREFIX;props.GITHUB_UPLOAD_PREFIX='bad/uploads';
  fail(()=>ctx.adminUploadProductImage('session',upload),/GITHUB_UPLOAD_PREFIX/);
  props.GITHUB_UPLOAD_PREFIX=existing;
});
pass(()=>{
  const old=props.GITHUB_TOKEN;props.GITHUB_TOKEN='';
  fail(()=>ctx.adminUploadProductImage('session',upload),/GITHUB_TOKEN/);
  props.GITHUB_TOKEN=old;
});
pass(()=>{
  assert.ok(html.includes('type="file" accept="image/jpeg,image/png,image/webp"'));
  assert.ok(html.includes("api('adminUploadProductImage',state.token,payload)"));
  assert.ok(html.includes("if(pendingImage){note("));
  assert.ok(!html.includes(props.GITHUB_TOKEN));
});
console.log('PASS: '+cases+' upload mock assertions (no network calls)');
