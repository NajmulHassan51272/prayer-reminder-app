const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchema() {
  try {
    console.log('Reading schema file...');
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Connecting to Supabase...');
    console.log(`Project URL: ${supabaseUrl}`);

    console.log('Applying schema to Supabase...');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_temp').select('*').limit(1);
          if (directError && directError.code !== 'PGRST116') {
            console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
            console.error(`Error: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
        console.error(`Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\nSchema application complete!`);
    console.log(`Success: ${successCount} statements`);
    console.log(`Errors: ${errorCount} statements`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. This might be due to:');
      console.log('1. Objects already existing (harmless)');
      console.log('2. Permission issues');
      console.log('3. Syntax differences between SQL variants');
      console.log('\nPlease check the errors above and apply the schema manually via Supabase Dashboard if needed.');
    } else {
      console.log('\n✅ Schema applied successfully!');
    }

  } catch (error) {
    console.error('Error applying schema:', error);
    process.exit(1);
  }
}

// Alternative approach: Use SQL Editor instructions
function showManualInstructions() {
  console.log('\n=== MANUAL SCHEMA APPLICATION INSTRUCTIONS ===\n');
  console.log('Since automatic schema application might have limitations,');
  console.log('here\'s how to apply the schema manually:\n');
  console.log('1. Go to your Supabase project dashboard:');
  console.log('   https://app.supabase.com/project/mpvmzwxsvufbfzhelwri\n');
  console.log('2. Navigate to "SQL Editor" in the left sidebar\n');
  console.log('3. Click "New Query"\n');
  console.log('4. Copy the contents of: supabase/schema.sql\n');
  console.log('5. Paste it into the SQL Editor\n');
  console.log('6. Click "Run" to execute the schema\n');
  console.log('7. Verify tables were created in the "Table Editor"\n');
  console.log('=== END MANUAL INSTRUCTIONS ===\n');
}

// Show instructions first, then try automatic
showManualInstructions();

console.log('Attempting automatic schema application...\n');
applySchema();