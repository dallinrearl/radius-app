import { supabase } from './supabase';

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('contacts').select('*').limit(1);

    if (error) {
      console.log('❌ Supabase error:', error.message);
      return { ok: false, message: error.message };
    }

    console.log('✅ Supabase connected. Contacts table accessible.');
    return { ok: true, count: data.length };
  } catch (err) {
    console.log('❌ Connection failed:', err.message);
    return { ok: false, message: err.message };
  }
}