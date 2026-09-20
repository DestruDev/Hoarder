// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_organic_drax.sql';
import m0001 from './0001_minor_firestar.sql';
import m0002 from './0002_normal_prism.sql';
import m0003 from './0003_hard_paibok.sql';
import m0004 from './0004_many_beast.sql';
import m0005 from './0005_modern_blue_marvel.sql';
import m0006 from './0006_rename_manga_to_comic.sql';
import m0007 from './0007_pretty_leopardon.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  