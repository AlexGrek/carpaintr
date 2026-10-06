import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from './index.js';

const input = () => ({ schemaVersion: 2, car: { year: '2020', carClass: 'B', bodyType: 'sedan' },
  parts: { selectedParts: [{ name: 'Hood', selectedAction: 'repair' }] }, normRates: { base: 100, currency: 'UAH', additional: [] },
  processorSnapshot: 'exports.default=[{processorId:"paint",name:"Paint",run:x=>[x.mkRow({key:"coat",name:"Coat",evaluate:1.25})]}]',
  sourceSnapshot: { Hood: { tables: [] } }, generatedCalculations: {},
});
describe('MCP shared engine bridge', () => {
  it('processes, edits and exports the same resolved values', () => {
    const generated = execute({document: input(), process: true});
    assert.equal(generated.document.grandTotal, 125);
    const row = generated.document.calculations.Hood[0].result[0];
    const edited = execute({document: generated.document, changes: {edits: [{entity_id:row.id,field:'sum',value:'20,05'}]}});
    assert.equal(edited.document.grandTotal, 20.05);
    assert.equal(edited.output.grand_total, 20.05);
    assert.equal(edited.output.calc.Hood[0].result[0].sum, 20.05);
  });
  it('returns invalid cells and blocks finalization while retaining committed cells', () => {
    const generated=execute({document:input(),process:true});
    const row=generated.document.calculations.Hood[0].result[0];
    const result=execute({document:generated.document,changes:{edits:[{entity_id:row.id,field:'sum',value:'bad'}]}});
    assert.equal(result.ready,false);
    assert.equal(result.invalid_cells[0].entity_id,row.id);
    assert.equal(result.document.grandTotal,125);
  });
  it('archives removals, restores their edits and rejects unknown IDs', () => {
    const generated=execute({document:input(),process:true});
    const row=generated.document.calculations.Hood[0].result[0];
    const edited=execute({document:generated.document,changes:{edits:[{entity_id:row.id,field:'sum',value:50}]}});
    const removed=execute({document:edited.document,changes:{parts:[]}});
    assert.equal(removed.document.grandTotal,0);
    const restored=execute({document:removed.document,changes:{parts:[{name:'Hood',selectedAction:'repair'}]}});
    assert.equal(restored.document.grandTotal,50);
    const cleared=execute({document:removed.document,changes:{parts:[{name:'Hood',selectedAction:null}]}});
    assert.ok(cleared.missing_inputs.includes('parts.Hood.action'));
    assert.equal(cleared.ready,false);
    assert.throws(()=>execute({document:generated.document,changes:{edits:[{entity_id:'fake',field:'sum',value:1}]}}));
  });
});
