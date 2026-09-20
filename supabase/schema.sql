-- Prayer Reminder App - Supabase PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (Supabase Auth will handle authentication, this stores additional user data)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prayer times table
CREATE TABLE IF NOT EXISTS prayer_times (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD (local date for that user)
  timezone TEXT, -- IANA tz string returned by Aladhan
  fajr TEXT, dhuhr TEXT, asr TEXT, maghrib TEXT, isha TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id UUID,
  prayer_name TEXT NOT NULL, -- Fajr / Dhuhr / Asr / Maghrib / Isha
  date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | missed
  notified_at TIMESTAMP WITH TIME ZONE,
  followup_sent_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, prayer_name, date)
);

-- Notifications log table
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  prayer_name TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- reminder | followup
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prayer_name, date, type)
);

-- Group invitations table
CREATE TABLE IF NOT EXISTS group_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' -- pending | accepted | expired
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prayer_times_user_date ON prayer_times(user_id, date);
CREATE INDEX IF NOT EXISTS idx_responses_user_date ON responses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_responses_group_date ON responses(group_id, date);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON group_invitations(token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON group_invitations(email);

-- Enable Row Level Security
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles (users can only see their own profile)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for groups (more complex - need to handle group membership)
DROP POLICY IF EXISTS "Anyone can view groups" ON groups;
CREATE POLICY "Anyone can view groups" ON groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
CREATE POLICY "Authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create policies for prayer_times (users can only see their own prayer times)
DROP POLICY IF EXISTS "Users can view own prayer times" ON prayer_times;
CREATE POLICY "Users can view own prayer times" ON prayer_times
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = prayer_times.user_id AND auth.uid() = id
    )
  );

DROP POLICY IF EXISTS "Users can insert own prayer times" ON prayer_times;
CREATE POLICY "Users can insert own prayer times" ON prayer_times
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = prayer_times.user_id AND auth.uid() = id
    )
  );

-- Create policies for responses (users can see their own and group members' responses)
DROP POLICY IF EXISTS "Users can view own responses" ON responses;
CREATE POLICY "Users can view own responses" ON responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = responses.user_id AND auth.uid() = id
    )
  );

DROP POLICY IF EXISTS "Users can update own responses" ON responses;
CREATE POLICY "Users can update own responses" ON responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = responses.user_id AND auth.uid() = id
    )
  );

DROP POLICY IF EXISTS "Users can insert own responses" ON responses;
CREATE POLICY "Users can insert own responses" ON responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = responses.user_id AND auth.uid() = id
    )
  );

-- Create policies for notifications_log
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications_log;
CREATE POLICY "Users can view own notifications" ON notifications_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = notifications_log.user_id AND auth.uid() = id
    )
  );

-- Create policies for group_invitations
DROP POLICY IF EXISTS "Users can view invitations for their email" ON group_invitations;
CREATE POLICY "Users can view invitations for their email" ON group_invitations
  FOR SELECT USING (
    email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create invitations" ON group_invitations;
CREATE POLICY "Authenticated users can create invitations" ON group_invitations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
