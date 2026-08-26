const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Initialize Supabase service-role client (server-side only)
const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);

module.exports = supabase;
