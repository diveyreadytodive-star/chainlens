import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseInput, formatUnits, decodeLogs, interpretFacts, TRANSFER_TOPIC, APPROVAL_TOPIC} from '../lib/interpreter.mjs';
import {explain, validateExplanation} from '../lib/ai.mjs';

const hash = `0x${'a'.repeat(64)}`;
const sender = `0x${'1'.repeat(40)}`;
const recipient = `0x${'2'.repeat(40)}`;
const token = `0x${'3'.repeat(40)}`;
const addressTopic = address => `0x${'0'.repeat(24)}${address.slice(2)}`;
const word = amount => `0x${BigInt(amount).toString(16).padStart(64, '0')}`;
const log = (topic, amount) => ({address:token, topics:[topic,addressTopic(sender),addressTopic(recipient)], data:word(amount), logIndex:'0x0'});
const tx = {hash,from:sender,to:recipient,input:'0x',value:'0x0',type:'0x2',gasPrice:'0x1'};
const receipt = {transactionHash:hash,status:'0x1',gasUsed:'0x5208',effectiveGasPrice:'0x3b9aca00',blockNumber:'0x64',logs:[]};
const source = {mode:'stored',provider:'test fixture',fetchedAt:'2026-09-12T00:00:00.000Z'};
const base = {hash,transaction:tx,receipt,metadata:{[token]:{decimals:6,symbol:'USDC'}},source,blockNumber:'0x66',finalizedBlockNumber:'0x63'};

test('parses supported transaction hashes and exact Ethereum explorer URLs', () => {
  assert.equal(parseInput(hash.toUpperCase().replace('0X','0x')),hash);
  assert.equal(parseInput(`https://etherscan.io/tx/${hash}?x=1#eventlog`),hash);
  assert.equal(parseInput(`https://eth.blockscout.com/tx/${hash}`),hash);
});

test('rejects arbitrary hosts, URL credentials, non-Ethereum and malformed inputs', () => {
  for (const input of ['', '0x123', `https://etherscan.io.evil.test/tx/${hash}`, `https://user@etherscan.io/tx/${hash}`, `https://sepolia.etherscan.io/tx/${hash}`, `http://etherscan.io/tx/${hash}`, `https://etherscan.io:8443/tx/${hash}`, `file:///tx/${hash}`, `https://etherscan.io/address/${sender}`]) assert.throws(()=>parseInput(input));
});

test('retains precise BigInt quantities without floating point rounding', () => {
  assert.equal(formatUnits(123456789123456789123456789n,18),'123456789.123456789123456789');
  assert.equal(formatUnits(1n,18),'0.000000000000000001');
  assert.equal(formatUnits(1000000n,6),'1');
  assert.equal(formatUnits(0n,6),'0');
});

test('uses receipt Transfer logs, keeps gas separate and perspective explicit', () => {
  const result=interpretFacts({...base,receipt:{...receipt,logs:[log(TRANSFER_TOPIC,1234567)]},transaction:{...tx,input:'0xa9059cbb'},perspective:sender});
  assert.equal(result.category,'token_transfer');
  assert.equal(result.transfers[0].amount,'1.234567');
  assert.equal(result.transfers[0].direction,'나감');
  assert.equal(result.fee.amount,'0.000021');
  assert.equal(result.fee.gasUsed,'21000');
  assert.equal(result.transfers.length,1);
  assert.equal(result.finality.state,'included');
  assert.equal(result.finality.confirmations,'3');
});

test('approval is historical setting and never counted as a transfer', () => {
  const result=interpretFacts({...base,receipt:{...receipt,logs:[log(APPROVAL_TOPIC,1000000)]}});
  assert.equal(result.category,'approval');
  assert.equal(result.approvals[0].amount,'1');
  assert.equal(result.transfers.length,0);
  assert.ok(result.limitations.some(x=>x.includes('현재 허용량')));
});

test('maximum approval is flagged while preserving its exact raw integer', () => {
  const amount=2n**256n-1n;
  const result=interpretFacts({...base,receipt:{...receipt,logs:[log(APPROVAL_TOPIC,amount)]}});
  assert.equal(result.approvals[0].unlimited,true);
  assert.equal(result.approvals[0].rawAmount,amount.toString());
});

test('failed transaction does not report transfer or approval despite calldata or bad logs', () => {
  const result=interpretFacts({...base,transaction:{...tx,value:'0xde0b6b3a7640000',input:'0xa9059cbb'},receipt:{...receipt,status:'0x0',logs:[log(TRANSFER_TOPIC,123),log(APPROVAL_TOPIC,123)]}});
  assert.equal(result.status,'failed');
  assert.equal(result.transfers.length,0);
  assert.equal(result.approvals.length,0);
  assert.equal(result.fee.amount,'0.000021');
});

test('pending or absent transactions cannot claim completed movement', () => {
  const pending=interpretFacts({...base,transaction:{...tx,value:'0xde0b6b3a7640000'},receipt:null});
  assert.equal(pending.status,'pending');assert.equal(pending.confidence,'unknown');assert.equal(pending.transfers.length,0);assert.equal(pending.fee,null);
  const missing=interpretFacts({...base,transaction:null,receipt:null});
  assert.equal(missing.status,'not_found');assert.equal(missing.confidence,'unknown');
});

test('unknown contract calls remain partial and never guessed as swaps', () => {
  const result=interpretFacts({...base,transaction:{...tx,input:'0x12345678'},receipt:{...receipt,logs:[{topics:['0xunknown'],data:'0x',address:token}]}});
  assert.equal(result.confidence,'partial');assert.equal(result.category,'contract_interaction');assert.equal(result.transfers.length,0);assert.equal(result.unsupportedLogCount,1);
});

test('ERC721 indexed tokenId and malformed logs are not decoded as ERC20', () => {
  const nft={...log(TRANSFER_TOPIC,0),topics:[TRANSFER_TOPIC,addressTopic(sender),addressTopic(recipient),word(42)],data:'0x'};
  const malformed={...log(TRANSFER_TOPIC,1),topics:[TRANSFER_TOPIC,`0x${'f'.repeat(64)}`,addressTopic(recipient)]};
  const result=decodeLogs([nft,malformed]);assert.equal(result.events.length,0);assert.equal(result.unsupported,2);
});

test('missing decimals preserve raw units and mark interpretation partial', () => {
  const result=interpretFacts({...base,metadata:{},receipt:{...receipt,logs:[log(TRANSFER_TOPIC,1234567)]}});
  assert.equal(result.transfers[0].amount,'1234567');assert.equal(result.transfers[0].amountUnit,'원시 단위');assert.equal(result.confidence,'partial');
});

test('native value is top-level value and not claimed to be a net balance change', () => {
  const result=interpretFacts({...base,transaction:{...tx,value:'0xde0b6b3a7640000'},finalizedBlockNumber:'0x65'});
  assert.equal(result.transfers[0].amount,'1');assert.equal(result.fee.amount,'0.000021');assert.equal(result.finality.state,'finalized');assert.ok(result.limitations.some(x=>x.includes('실제 잔액의 순변화가 아닙니다')));
});

test('unknown effective gas price on dynamic fee tx remains unknown, blob fees are explicit', () => {
  const result=interpretFacts({...base,receipt:{...receipt,effectiveGasPrice:undefined}});assert.equal(result.fee,null);
  const blob=interpretFacts({...base,transaction:{...tx,type:'0x3'}});assert.equal(blob.fee.complete,false);
  const full=interpretFacts({...base,transaction:{...tx,type:'0x3'},receipt:{...receipt,blobGasUsed:'0x2',blobGasPrice:'0x1'}});assert.equal(full.fee.amount,'0.000021000000000002');assert.equal(full.fee.complete,true);
});

test('rejects mismatched transaction evidence and malformed perspective', () => {
  assert.throws(()=>interpretFacts({...base,receipt:{...receipt,transactionHash:`0x${'b'.repeat(64)}`}}));
  assert.throws(()=>interpretFacts({...base,perspective:'my wallet'}));
});

test('AI guard rejects numeric/address changes and explicit state contradictions', () => {
  assert.equal(validateExplanation('이 거래에서 100 ETH가 전송되었습니다.'),false);
  assert.equal(validateExplanation('토큰이 0x123 주소로 전송되었습니다.'),false);
  assert.equal(validateExplanation('거래가 성공하여 전송이 완료되었습니다.',{status:'failed'}),false);
  assert.equal(validateExplanation('토큰이 받는 주소로 전송되었습니다.',{category:'approval',transfers:[]}),false);
  assert.equal(validateExplanation('이 거래는 토큰의 사용 권한을 설정합니다. 이 설정은 토큰 전송과 구분됩니다.'),true);
});

test('AI adapter failure or scalar mutation falls back to deterministic explanation', async () => {
  const facts=interpretFacts(base);
  const mutation=await explain(facts,{adapter:async()=>({text:'이 거래는 100 ETH를 보냈습니다.'})});assert.equal(mutation.mode,'rules');
  const failed=await explain(facts,{adapter:async()=>{throw new Error('unavailable');}});assert.equal(failed.mode,'rules');
  const good=await explain(facts,{adapter:async()=>({text:'전송 값과 네트워크 수수료는 구분됩니다. 실행 결과는 영수증에서 확인할 수 있습니다.'})});assert.equal(good.mode,'ai');
});

test('Groq success uses the default model and only categorical facts', async () => {
  const previous = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-key';
  try {
    let request;
    const facts=interpretFacts(base);
    const result=await explain(facts,{fetch:async (url, options) => {
      request={url, options};
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'전송 값과 네트워크 수수료는 구분됩니다. 실행 결과는 영수증에서 확인할 수 있습니다.'})}}]}),{status:200});
    }});
    assert.equal(result.mode,'ai');assert.equal(result.provider,'Groq');assert.equal(request.url,'https://api.groq.com/openai/v1/chat/completions');
    const body=JSON.parse(request.options.body);assert.equal(body.model,'openai/gpt-oss-20b');assert.deepEqual(JSON.parse(body.messages[1].content),{status:'success',category:'eth_transfer',hasTransfers:false,hasApprovals:false,hasUnsupportedLogs:false,finality:'included'});
  } finally { if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY=previous; }
});

test('Groq HTTP errors, timeout, malformed JSON, and guard failures use rules', async () => {
  const previous = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-key';
  try {
    const facts=interpretFacts(base);
    const httpFailure=await explain(facts,{fetch:async()=>new Response('',{status:503})});assert.equal(httpFailure.mode,'rules');assert.match(httpFailure.reason,/HTTP 503/);
    const timeout=await explain(facts,{timeoutMs:5,fetch:async (_url, options)=>new Promise((_, reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))});assert.equal(timeout.mode,'rules');
    const malformed=await explain(facts,{fetch:async()=>new Response(JSON.stringify({choices:[{message:{content:'not-json'}}]}),{status:200})});assert.equal(malformed.mode,'rules');
    const guardFailure=await explain(facts,{fetch:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'이 거래는 100 ETH를 보냈습니다.'})}}]}),{status:200})});assert.equal(guardFailure.mode,'rules');assert.match(guardFailure.reason,/보호 검사/);
  } finally { if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY=previous; }
});

test('real stored snapshots have reproducible facts and source timestamps', async () => {
  const data=JSON.parse(await readFile(new URL('../data/examples.json',import.meta.url),'utf8'));
  const list=Array.isArray(data)?data:data.examples;
  assert.ok(list.length>=4);
  for(const example of list){const facts=interpretFacts({...example,source:{mode:'stored',provider:example.source,fetchedAt:example.fetchedAt}});assert.equal(facts.hash,example.hash);assert.ok(example.fetchedAt || example.source?.fetchedAt);if(example.id==='approval'){assert.equal(facts.approvals.length,1);assert.equal(facts.transfers.length,0);}if(example.id==='erc20-transfer')assert.equal(facts.transfers[0].amountUnit,'USDC');if(example.id==='failed'){assert.equal(facts.status,'failed');assert.equal(facts.transfers.length,0);}}
});
