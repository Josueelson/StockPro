// ============================================
// StockPro - Supabase Configuration
// ============================================

const SUPABASE_URL = 'https://pbdxiwpvxhrtygvmlydk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZHhpd3B2eGhydHlndm1seWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Mjk5MTIsImV4cCI6MjA4ODIwNTkxMn0.5j73KWW64QC3h-gGOKIlZ15OtcqTfHJjiHZomct1W4Y';

// Save the UMD library reference BEFORE anything else shadow it
var _supabaseLib = window.supabase;

// Use 'var' so this creates a true window property accessible from all scripts.
// The IIFE evaluates window.supabase BEFORE var supabase re-assigns window.supabase.
var supabase = (function () {
    try {
        if (_supabaseLib && typeof _supabaseLib.createClient === 'function') {
            var client = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client initialized successfully.');
            return client;
        } else {
            console.error('Supabase library not found or createClient is missing. window.supabase was:', _supabaseLib);
            return null;
        }
    } catch (e) {
        console.error('Error during Supabase initialization:', e);
        return null;
    }
})();
