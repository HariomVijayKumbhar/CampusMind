// Auth Service - token verification and profile lookups
// Full implementation in Phase 1

const supabase = require('../config/supabaseClient');

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}

module.exports = {
  getProfile,
};
