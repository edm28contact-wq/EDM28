const PREVIEW_SUPABASE_URL = 'https://vbfklmcjrdlqismewmly.supabase.co';
const PREVIEW_SUPABASE_ANON_KEY = 'sb_publishable_7pT3ZVabu5lL-mq1eC1uwA_fucXtYqI';
const PRODUCTION_SUPABASE_URL = 'https://ojjbnwpkfvzjfukgqddz.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY = 'sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX';

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

export function isProductionEnvironment() {
  return process.env.VERCEL_ENV === 'production';
}

export function resolveSupabasePublicConfig() {
  if (isProductionEnvironment()) {
    return {
      environment: 'production',
      url: firstNonEmpty(
        process.env.SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        PRODUCTION_SUPABASE_URL
      ),
      key: firstNonEmpty(
        process.env.SUPABASE_ANON_KEY,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        PRODUCTION_SUPABASE_ANON_KEY
      )
    };
  }

  return {
    environment: 'preview',
    url: firstNonEmpty(process.env.PREVIEW_SUPABASE_URL, PREVIEW_SUPABASE_URL),
    key: firstNonEmpty(process.env.PREVIEW_SUPABASE_ANON_KEY, PREVIEW_SUPABASE_ANON_KEY)
  };
}

export function resolveSupabaseServiceConfig() {
  const publicConfig = resolveSupabasePublicConfig();
  const serviceRoleKey = publicConfig.environment === 'production'
    ? firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY)
    : firstNonEmpty(process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY);

  return { ...publicConfig, serviceRoleKey };
}
