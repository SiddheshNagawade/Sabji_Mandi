// Schema migration stub. Each entry migrates from its key version to key+1.
// Currently there is only schemaVersion 1, so this is a no-op passthrough
// that still validates the version is one we understand.

import { SCHEMA_VERSION } from './schema';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, Migration> = {
  // 1: (raw) => ({ ...raw, schemaVersion: 2, /* ... */ }),
};

export function migrateProjectData(raw: Record<string, unknown>): Record<string, unknown> {
  let data = raw;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`Project was saved with a newer schema (v${version}) than this build supports (v${SCHEMA_VERSION}).`);
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) {
      throw new Error(`No migration path from schema v${version} to v${SCHEMA_VERSION}.`);
    }
    data = step(data);
    version = typeof data.schemaVersion === 'number' ? data.schemaVersion : version + 1;
  }
  // Structural backfill, not a versioned migration: projects saved before the
  // project library existed have no stable id.
  if (typeof data.id !== 'string' || data.id.length === 0) {
    data = { ...data, id: crypto.randomUUID() };
  }
  return data;
}
