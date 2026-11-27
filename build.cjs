require('./previous-build.cjs');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['search-navigation-build.cjs'], {stdio:'inherit'});
require('./wahlen-build.cjs');
require('./word-suggestions-build.cjs');
require('./pwa-build.cjs');
