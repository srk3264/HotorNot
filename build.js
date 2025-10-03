const fs = require('fs');

const config = `// Supabase Configuration (Generated)
const SUPABASE_CONFIG = {
    url: '${process.env.SUPABASE_URL}',
    anonKey: '${process.env.SUPABASE_ANON_KEY}'
};

const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);`;

fs.writeFileSync('supabase-config.js', config);
