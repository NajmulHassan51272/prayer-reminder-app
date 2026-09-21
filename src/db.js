// This is a trusted, server-side data layer. The app authenticates users with
// cookie sessions and never forwards a per-user JWT to PostgREST, so RLS
// policies based on auth.uid() can never match for requests made here. Using
// the anon key therefore silently returns zero rows (and blocks writes) once
// RLS is enabled — breaking login, dashboards, and the scheduler. Every query
// in this module must run with the service-role key, which bypasses RLS.
const { supabaseAdmin } = require('./supabase');
const supabase = supabaseAdmin;

// Database helper functions using Supabase
const db = {
  // Groups
  async createGroup(groupData) {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert(groupData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getGroupByCode(code) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('code', code)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getGroupById(id) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateGroup(id, updates) {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteGroup(id) {
    const { error } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // User Profiles
  async createUserProfile(profileData) {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUserProfile(userId, updates) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Prayer Times
  async createPrayerTime(prayerTimeData) {
    const { data, error } = await supabase
      .from('prayer_times')
      .insert(prayerTimeData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPrayerTime(userId, date) {
    const { data, error } = await supabase
      .from('prayer_times')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getPrayerTimesByUser(userId) {
    const { data, error } = await supabase
      .from('prayer_times')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updatePrayerTime(id, updates) {
    const { data, error } = await supabase
      .from('prayer_times')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Responses
  async createResponse(responseData) {
    const { data, error } = await supabase
      .from('responses')
      .insert(responseData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getResponse(userId, prayerName, date) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('user_id', userId)
      .eq('prayer_name', prayerName)
      .eq('date', date)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getResponsesByUser(userId) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getResponsesByGroup(groupId) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('group_id', groupId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateResponse(id, updates) {
    const { data, error } = await supabase
      .from('responses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTodayResponsesByGroup(groupId, date) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('group_id', groupId)
      .eq('date', date);
    if (error) throw error;
    return data;
  },

  // Notifications Log
  async createNotificationLog(notificationData) {
    const { data, error } = await supabase
      .from('notifications_log')
      .insert(notificationData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getNotificationLog(userId, prayerName, date, type) {
    const { data, error } = await supabase
      .from('notifications_log')
      .select('*')
      .eq('user_id', userId)
      .eq('prayer_name', prayerName)
      .eq('date', date)
      .eq('type', type)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Group Invitations
  async createInvitation(invitationData) {
    const { data, error } = await supabaseAdmin
      .from('group_invitations')
      .insert(invitationData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getInvitationByToken(token) {
    const { data, error } = await supabaseAdmin
      .from('group_invitations')
      .select('*')
      .eq('token', token)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateInvitation(id, updates) {
    const { data, error } = await supabaseAdmin
      .from('group_invitations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPendingInvitationsByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('group_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Get all users in a group
  async getGroupMembers(groupId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('group_id', groupId);
    if (error) throw error;
    return data;
  },

  // Remove user from group
  async removeUserFromGroup(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ group_id: null })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

module.exports = db;
