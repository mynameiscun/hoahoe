/* Offline tests, use Node 18+; mocks Sheets, Apps Script Properties, and lock.
 * Does not contact Google or create real orders.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(path.resolve(__dirname,'../../google-apps-script/Code.gs'),'utf8');
const sheets = new Map();
const getRows = (name) => sheets.get(name).rows;
const makeSheet = name => {
  const sheet = {
    rows: [],
    getLastRow() {return this.rows.length;},
    appendRow(row) {this.rows.push(row.map(x => x));},
    getDataRange() {return {getValues: () => this.rows.map(r => r.slice())};},
    getRange(rangeOrRow,col,numRows,numCols) {
      return {
        setNumberFormat(){return this;}, setDataValidation(){return this;},
        setValues(data) { for(let i=0;i<data.length;i++) sheet.rows[(rangeOrRow||2)-1+i]=data[i].slice(); return this; },
        insertCheckboxes(){return this;}, check(){return this;}
      };
    },
    setFrozenRows(){ }
  };
  sheets.set(name, sheet);
  return sheet;
};
let uuid = 0;
const context = {
  console,
  Logger:{log(){}},
  Date,
  JSON,
  Number,
  PropertiesService:{getScriptProperties(){return {getProperty:k=>({SHEET_ID:'test-sheet',GAS_API_KEY:'x'.repeat(48)})[k]};}},
  ContentService: {MimeType:{JSON:'json'},createTextOutput(txt){return {body:txt,setMimeType(){return this;}};}},
  SpreadsheetApp: {
    openById(){return {getSheetByName:n=>sheets.get(n),insertSheet:n=>makeSheet(n)};},
    newDataValidation(){return {requireValueInList(){return this;},build(){return {};}};},
    flush(){ }
  },
  Utilities:{
    formatDate(dt,tz,fmt){
      const date = new Date(dt).toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',hour12:false}).replace(' ','T');
      if(fmt==='yyyy-MM-dd')return date.slice(0,10);
      return date.slice(0,19).replace('T',' ');
    },
    getUuid(){uuid++;return String(uuid).padStart(8,'0')+'-1111-4111-9111-123456789012';}
  },
  LockService:{getScriptLock(){return {tryLock(){return true;},releaseLock(){}};}}
};
vm.createContext(context);
vm.runInContext(code,context,{filename:'Code.gs'});
context.setupHoaHoeSheets();
assert.equal(getRows('Products').length,10);
assert.equal(getRows('Orders').length,1);
const call=(action,payload)=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({key:'x'.repeat(48),action,payload})}}).body);
const data={
  submission_id:'f9c46765-322c-4f67-8f23-143a73925100',
  customer_name:'Khách thử', customer_phone:'0912345678', customer_email:'',
  recipient_name:'Người nhận', recipient_phone:'0987654321',
  delivery_district_code:'760', delivery_ward_code:'manual',
  delivery_ward_manual:'Bến Nghé', delivery_street:'25 Nguyễn Huệ',
  delivery_date:new Date(Date.now()+60*86400000).toISOString().slice(0,10), delivery_slot:'09-12',note:'Xin chào',
  items:[{code:'hoa-001',quantity:2}]
};
const previousDate = Date.now;
// Avoid mocked clock: schedule uses actual date in Oct 2026 for example.
assert.equal(call('products',{}).products.length,9);
const preview=call('preview',data);
assert.equal(preview.ok,true, JSON.stringify(preview));
assert.equal(preview.subtotal,500000);
assert.equal(call('submit',data).ok,true);
assert.equal(getRows('Orders').length,2);
const again=call('submit',data);
assert.equal(again.already_submitted,true);
assert.equal(getRows('Orders').length,2);
const id=getRows('Orders')[1][0];
assert.equal(call('lookup',{order_code:id,buyer_phone:'0912345678'}).subtotal,500000);
assert.equal(call('lookup',{order_code:id,buyer_phone:'0912345679'}).error_code,'not_found');
assert.equal(call('lookup',{order_code:id,buyer_phone:'0912345678'}).customer_name,undefined);
// Client submitted price cannot change server totals.
assert.equal(call('preview',{...data,subtotal:1,items:[{code:'hoa-001',quantity:2,price:1}]}).subtotal,500000);
// After manager edits Products price, previews use the new price.
getRows('Products')[1][2]=300000;
assert.equal(call('preview',data).subtotal,600000);
assert.equal(call('preview',{...data,delivery_date:'2020-01-01'}).ok,false);
assert.equal(call('preview',{...data,delivery_district_code:'999'}).ok,false);
assert.equal(call('submit',{...data,submission_id:'bad-id'}).ok,false);
// Injecting spreadsheet formulas into user notes is escaped.
const formulaData={...data,submission_id:'a9c46765-322c-4f67-8f23-143a73925101',note:'=IMPORTXML("evil")'};
assert.equal(call('submit',formulaData).ok,true);
assert.ok(getRows('Orders').at(-1)[13].startsWith("'="));
console.log('PASS: 15 checks on local Sheets service mock (no Google connection).');
