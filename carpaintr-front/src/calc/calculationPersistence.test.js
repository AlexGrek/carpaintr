import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeSaved, createSaveCoordinator, shouldRecordUndo } from './calculationPersistence.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const document = () => ({ calculationId: 'calc-A', revision: 7, car: { year: '2020' }, calculations: { Hood: [{ total: 17 }] } });

describe('document owner save coordination', () => {
  it('keeps a single save lock across stage remounts and preserves newer edits on acknowledgment', async () => {
    const request = deferred(); let current = document(); let calls = 0;
    const snapshot = current; const pending = [];
    const coordinator = createSaveCoordinator({
      getOwner: () => ({ calculationId: current.calculationId, epoch: 1 }),
      request: () => { calls++; return request.promise; }, onPending: value => pending.push(value),
      onAcknowledged: (saved, filename) => { current = acknowledgeSaved(current, saved, filename); },
    });
    const save = coordinator.save(snapshot);
    current = { ...current, revision: 8, calculations: { Hood: [{ total: 91 }] } };
    await assert.rejects(coordinator.save(current), /already in progress/);
    assert.equal(calls, 1);
    request.resolve({ saved_file_path: 'saved.json' });
    assert.equal((await save).acknowledged, true);
    assert.equal(current.calculations.Hood[0].total, 91);
    assert.equal(current.revision, 8);
    assert.equal(current.lastSavedRevision, 7);
    assert.equal(current.car.storeFileName, 'saved.json');
    assert.deepEqual(pending, [true, false]);
  });

  it('ignores an old response when another calculation is opened, including the same saved calculation', async () => {
    for (const reopenedId of ['calc-B', 'calc-A']) {
      const request = deferred(); let owner = { calculationId: 'calc-A', epoch: 1 }; let acknowledgments = 0;
      const coordinator = createSaveCoordinator({ request: () => request.promise, getOwner: () => owner,
        onPending: () => {}, onAcknowledged: () => acknowledgments++ });
      const save = coordinator.save(document());
      owner = { calculationId: reopenedId, epoch: 2 };
      request.resolve({ saved_file_path: 'old.json' });
      assert.equal((await save).acknowledged, false);
      assert.equal(acknowledgments, 0);
    }
  });

  it('releases a failed lock so the latest revision can be saved again', async () => {
    let count = 0; const pending = [];
    const coordinator = createSaveCoordinator({ getOwner: () => ({ calculationId: 'calc-A', epoch: 1 }),
      onPending: value => pending.push(value), onAcknowledged: () => {},
      request: async () => { if (count++ === 0) throw new Error('Offline'); return { saved_file_path: 'new.json' }; } });
    await assert.rejects(coordinator.save(document()), /Offline/);
    assert.equal((await coordinator.save(document())).acknowledged, true);
    assert.deepEqual(pending, [true, false, true, false]);
  });

  it('ignores acknowledgments for a different document and never moves saved revision backwards', () => {
    const current = { ...document(), lastSavedRevision: 9 };
    assert.equal(acknowledgeSaved(current, { ...document(), calculationId: 'other' }, 'other.json'), current);
    assert.equal(acknowledgeSaved(current, document(), 'same.json').lastSavedRevision, 9);
  });

  it('excludes generated/cache/view and save metadata changes from undo history', () => {
    const previous = document();
    assert.equal(shouldRecordUndo(previous, { ...previous, generatedCalculations: {}, processing: {}, sourceSnapshot: {}, tableMode: 'detailed' }), false);
    assert.equal(shouldRecordUndo(previous, { ...previous, car: { ...previous.car, storeFileName: 'saved.json' } }), false);
    assert.equal(shouldRecordUndo(previous, { ...previous, cellOverrides: { row: { sum: 17 } } }), true);
    assert.equal(shouldRecordUndo(previous, { ...previous, car: { ...previous.car, year: '2022' } }), true);
    assert.equal(shouldRecordUndo(previous, { ...previous, order: { orderNumber: '17' } }), true);
  });
});
