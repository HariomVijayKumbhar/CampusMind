// Auth Service - token verification and profile lookups with automatic self-healing

const supabase = require('../config/supabaseClient');

/**
 * Retrieves a user profile by ID, auto-creating it if it doesn't exist yet.
 * @param {string|object} user - User ID or Supabase User object
 */
async function getProfile(user) {
  const userId = typeof user === 'string' ? user : user.id;
  const fullName = typeof user === 'object' 
    ? (user.user_metadata?.full_name || user.user_metadata?.name || 'User') 
    : 'User';

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn(`[AuthService] Error fetching profile for ${userId}:`, error.message);
    }

    if (data) {
      return data;
    }

    // Auto-create/upsert the profile row if missing
    console.log(`[AuthService] Profile missing for ${userId}, auto-creating...`);
    const { data: createdProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          role: 'student',
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (upsertError) {
      console.warn(`[AuthService] Profile upsert warning:`, upsertError.message);
      return {
        id: userId,
        full_name: fullName,
        role: 'student',
        created_at: new Date().toISOString(),
      };
    }

    return createdProfile;
  } catch (err) {
    console.error(`[AuthService] Unexpected profile error:`, err);
    return {
      id: userId,
      full_name: fullName,
      role: 'student',
      created_at: new Date().toISOString(),
    };
  }
}

/**
 * Create a new user via the service-role client so the account is
 * immediately confirmed and can log in without email confirmation.
 */
async function signup(email, password, fullName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) throw error;

  // Ensure the public profiles row exists
  await getProfile(data.user);

  // Immediately sign the user in so we can return a session to the frontend
  const { data: sessionData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError) throw signInError;

  return {
    user: sessionData.user,
    session: sessionData.session,
  };
}

module.exports = {
  getProfile,
  signup,
};
