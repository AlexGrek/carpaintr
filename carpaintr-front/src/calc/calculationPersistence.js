/** Metadata acknowledgments never replace editable calculation cells. */
export function acknowledgeSaved(document, snapshot, filename) {
  if (document.calculationId !== snapshot.calculationId) return document;
  return {
    ...document,
    lastSavedRevision: Math.max(document.lastSavedRevision ?? -1, snapshot.revision ?? 0),
    car: { ...document.car, storeFileName: filename },
  };
}

/** One coordinator belongs to the document owner, above all stage mounts. */
export function createSaveCoordinator({ request, getOwner, onAcknowledged, onPending }) {
  let pending = false;
  return {
    async save(snapshot) {
      if (pending) throw new Error('A calculation save is already in progress');
      const owner = getOwner();
      if (owner.calculationId !== snapshot.calculationId) throw new Error('Calculation changed before saving');
      pending = true;
      onPending(true);
      try {
        const result = await request(snapshot);
        if (!result.saved_file_path) throw new Error('Save response did not include a filename');
        const current = getOwner();
        const acknowledged = current.calculationId === owner.calculationId && current.epoch === owner.epoch;
        if (acknowledged) onAcknowledged(snapshot, result.saved_file_path);
        return { ...result, acknowledged };
      } finally {
        pending = false;
        onPending(false);
      }
    },
  };
}


/** Processing/cache/save metadata and view changes are not operator edits. */
export function shouldRecordUndo(previous, next) {
  const fields = ['cellOverrides', 'cellDrafts', 'inputOverrides', 'parts', 'paint', 'normRates', 'normRateOverrides', 'order'];
  if (fields.some(field => previous[field] !== next[field])) return true;
  const carInputs = car => {
    const { storeFileName: _filename, ...inputs } = car ?? {};
    return inputs;
  };
  return JSON.stringify(carInputs(previous.car)) !== JSON.stringify(carInputs(next.car));
}
