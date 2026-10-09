import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20261009_032231_add_tripp_collections from './20261009_032231_add_tripp_collections';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20261009_032231_add_tripp_collections.up,
    down: migration_20261009_032231_add_tripp_collections.down,
    name: '20261009_032231_add_tripp_collections'
  },
];
