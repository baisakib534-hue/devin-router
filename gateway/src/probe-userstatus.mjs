// Deterministic account-presentation probe: POST GetUserStatus to the gateway,
// decode the protobuf, print plan tier + name + identity. Proves the gateway
// presents the top-tier plan regardless of the real account's actual plan.
import { readFileSync } from "fs";

function readVarint(b, o) { let v=0n,s=0n,c=o; while(c<b.length){const x=b[c++]; v|=BigInt(x&0x7f)<<s; if((x&0x80)===0)break; s+=7n;} return {value:v,end:c}; }
function fields(b){ const out=[]; let o=0; while(o<b.length){ const k=readVarint(b,o); o=k.end; const fn=Number(k.value>>3n), wt=Number(k.value&7n); if(wt===0){const v=readVarint(b,o);o=v.end;out.push({fn,wt,v:Number(v.value)});} else if(wt===2){const l=readVarint(b,o);o=l.end;const e=o+Number(l.value);out.push({fn,wt,v:b.subarray(o,e)});o=e;} else if(wt===5){o+=4;} else if(wt===1){o+=8;} else break; } return out; }
function str(b){ return Buffer.isBuffer(b)?b.toString("utf8"):""; }

const res = await fetch("http://127.0.0.1:20130/exa.seat_management_pb.SeatManagementService/GetUserStatus", {
  method: "POST",
  headers: { "Content-Type": "application/proto", "Connect-Protocol-Version": "1" },
  body: Buffer.alloc(0),
});
const buf = Buffer.from(await res.arrayBuffer());
const top = fields(buf);
const userStatus = top.find(f=>f.fn===1)?.v;
const planInfo = top.find(f=>f.fn===2)?.v;
const us = userStatus?fields(userStatus):[];
const pi = planInfo?fields(planInfo):[];
const name = us.find(f=>f.fn===3)?.v;
const email = us.find(f=>f.fn===7)?.v;
const teamsTier = pi.find(f=>f.fn===1)?.v;
const planName = pi.find(f=>f.fn===2)?.v;
const out = { httpStatus: res.status, identity: { name: name?str(name):"", email: email?str(email):"" }, plan: { teamsTier, planName: planName?str(planName):"" } };
console.log(JSON.stringify(out, null, 2));
