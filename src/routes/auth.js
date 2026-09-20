const express = require("express");
const { supabase, supabaseAdmin } = require("../supabase");
const db = require("../db");

const router = express.Router();

router.get("/register", async (req, res) => {
  const inviteToken = req.query.invite || null;
  let invitation = null;
  
  console.log(`[register] GET request with invite token: ${inviteToken}`);
  
  if (inviteToken) {
    try {
      // Use existing db helper to fetch the invitation
      const data = await db.getInvitationByToken(inviteToken);
      
      if (data && data.status === 'pending' && new Date(data.expires_at) > new Date()) {
        // Fetch group and inviter details manually to avoid complex join issues
        const group = await db.getGroupById(data.group_id);
        const inviter = await db.getUserProfile(data.invited_by);
        
        invitation = {
          ...data,
          group_name: group ? group.name : 'Unknown Group',
          inviter_name: inviter ? inviter.name : 'Unknown User'
        };
        console.log(`[register] Found valid invitation:`, { id: invitation.id, group: invitation.group_name, email: invitation.email });
      } else {
        console.log(`[register] No valid invitation found`);
      }
    } catch (err) {
      console.error(`[register] Error fetching invitation:`, err);
    }
  }
  
  res.render("register", { error: null, invitation });
});

router.post("/register", async (req, res) => {
  const { name, email, password, city, country, invite_token } = req.body;

  console.log(`[register] POST request received`);
  console.log(`[register] Email: ${email}, Invite token: ${invite_token}`);

  if (!name || !email || !password || !city || !country) {
    return res.render("register", { error: "All fields are required." });
  }

  try {
    // Check if user already exists in Supabase Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email.toLowerCase().trim());
    
    if (existingUser) {
      console.log(`[register] User already exists with email: ${email}`);
      return res.render("register", { error: "An account with this email already exists. Please log in instead." });
    }

    // Sign up user with Supabase Auth (auto-confirm email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        city: city.trim(),
        country: country.trim()
      }
    });

    if (authError) {
      console.error(`[register] Supabase auth error:`, authError);
      // Provide more user-friendly error messages
      if (authError.message.includes('rate limit')) {
        return res.render("register", { error: "Too many signup attempts. Please wait a few minutes before trying again." });
      }
      return res.render("register", { error: authError.message });
    }

    if (!authData.user) {
      return res.render("register", { error: "Failed to create user account." });
    }

    const userId = authData.user.id;
    console.log(`[register] User created with ID: ${userId}`);

    // Create user profile
    const profileData = {
      id: userId,
      name: name.trim(),
      city: city.trim(),
      country: country.trim()
    };

    // Handle invitation if present
    if (invite_token && invite_token.trim()) {
      console.log(`[register] Processing invitation token: ${invite_token}`);
      
      const invitation = await db.getInvitationByToken(invite_token);
      
      if (invitation) {
        console.log(`[register] Found valid invitation: ID=${invitation.id}, Group=${invitation.group_id}, Email=${invitation.email}`);
        
        // Add user to the group
        profileData.group_id = invitation.group_id;
        
        // Mark invitation as accepted
        await db.updateInvitation(invitation.id, {
          status: 'accepted',
          accepted_at: new Date().toISOString()
        });
        
        console.log(`[register] Successfully added user ${userId} to group ${invitation.group_id}`);
        
        // Send email notification that they have been added to the group
        try {
          const { sendMail, groupAddedEmailHtml } = require("../services/email");
          await sendMail({
            to: email.toLowerCase().trim(),
            subject: `You've been added to ${invitation.group_name}`,
            html: groupAddedEmailHtml(invitation.inviter_name, invitation.group_name),
          });
          console.log(`[register] Sent group added email to ${email}`);
        } catch (emailErr) {
          console.error(`[register] Error sending group added email:`, emailErr);
        }
      } else {
        console.log(`[register] Invalid or expired invitation token: ${invite_token}`);
      }
    } else {
      console.log(`[register] No invitation token provided`);
    }

    // Create user profile
    await db.createUserProfile(profileData);

    req.session.userId = userId;
    console.log(`[register] Redirecting to dashboard for user ${userId}`);
    res.redirect("/dashboard");

  } catch (error) {
    console.error(`[register] Error:`, error);
    res.render("register", { error: "An error occurred during signup. Please try again." });
  }
});

// Keep /signup as an alias for /register for backward compatibility
router.get("/signup", (req, res) => {
  res.redirect("/register" + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''));
});

router.post("/signup", (req, res) => {
  res.redirect(307, "/register");
});

router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(`[login] Login attempt for email: ${email}`);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) {
      console.error(`[login] Supabase auth error:`, error);
      // Provide more specific error messages
      if (error.message.includes('Invalid login credentials')) {
        return res.render("login", { error: "Invalid email or password. Please check your credentials and try again." });
      }
      if (error.message.includes('Email not confirmed')) {
        return res.render("login", { error: "Please confirm your email address before logging in." });
      }
      return res.render("login", { error: error.message });
    }

    if (!data.user) {
      console.error(`[login] No user data returned`);
      return res.render("login", { error: "Login failed. Please try again." });
    }

    // Check if user profile exists
    const userProfile = await db.getUserProfile(data.user.id);
    if (!userProfile) {
      console.error(`[login] User profile not found for user: ${data.user.id}`);
      // Create profile if it doesn't exist
      try {
        await db.createUserProfile({
          id: data.user.id,
          name: data.user.user_metadata?.name || 'User',
          city: data.user.user_metadata?.city || '',
          country: data.user.user_metadata?.country || ''
        });
        console.log(`[login] Created missing profile for user: ${data.user.id}`);
      } catch (profileError) {
        console.error(`[login] Failed to create profile:`, profileError);
        return res.render("login", { error: "Account setup incomplete. Please contact support." });
      }
    }

    req.session.userId = data.user.id;
    console.log(`[login] User logged in successfully: ${data.user.id}`);
    res.redirect("/dashboard");

  } catch (error) {
    console.error(`[login] Error:`, error);
    res.render("login", { error: "An error occurred during login. Please try again." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error(`[logout] Error:`, error);
  }
  
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
