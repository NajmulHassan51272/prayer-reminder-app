const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://mpvmzwxsvufbfzhelwri.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdm16d3hzdnVmYmZ6aGVsd3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDU1OTUsImV4cCI6MjEwNTQ4MTU5NX0.g-zUmK-OcCXvHyCTBSlLFV4yH3fhbi4Jb3csKhckUAM';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdm16d3hzdnVmYmZ6aGVsd3JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTkwNTU5NSwiZXhwIjoyMTA1NDgxNTk1fQ.yj-e_rTAzJWa2kYjkDHrW9POz4Zkd7JJR_Vs541qaRc';

// Create Supabase client with anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
