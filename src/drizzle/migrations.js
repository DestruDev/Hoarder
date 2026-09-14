// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_organic_drax.sql';
import m0001 from './0001_minor_firestar.sql';
import m0002 from './0002_normal_prism.sql';
import m0003 from './0003_hard_paibok.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  