import test from 'node:test';import assert from 'node:assert/strict';import {investment,borrowing,periodRows,elapsedMonths} from './experiments.js';
test('investment reports profit only after fees recovered',()=>{const r=investment({capital:100000,monthly:0,annual:12,months:12,fee:2000,stress:10});assert.equal(r.base.first,3);assert.ok(r.down.profit<r.base.profit);assert.ok(r.up.profit>r.base.profit);});
test('negative return never promises profit',()=>{assert.equal(investment({capital:100000,monthly:0,annual:-10,months:36}).base.first,null);});
test('zero-interest debt pays off exactly, produces no profit',()=>{const r=borrowing({principal:100000,apr:0,payment:25000,months:5});assert.equal(r.finished,4);assert.equal(r.paid,100000);assert.equal(r.profit,0);assert.equal(r.first,null);});
test('debt grows when payment cannot cover interest',()=>{assert.ok(borrowing({principal:100000,apr:24,payment:1000,months:12}).left>100000);});
test('month and year filters isolate real transaction totals',()=>{const rows=[{date:'2026-01-02'},{date:'2026-02-03'},{date:'2025-01-01'}];assert.equal(periodRows(rows,'month','2026-01').length,1);assert.equal(periodRows(rows,'year','2026').length,2);assert.equal(periodRows(rows,'all','').length,3);assert.equal(elapsedMonths('2026-01-31','2026-02-28'),0);assert.equal(elapsedMonths('2026-01-01','2026-03-01'),2);});

