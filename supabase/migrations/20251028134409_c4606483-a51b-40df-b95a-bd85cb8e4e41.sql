-- Create enum for achievement types
CREATE TYPE achievement_type AS ENUM (
  'first_assessment',
  'perfect_compliance',
  'documents_uploaded_10',
  'documents_uploaded_50',
  'documents_uploaded_100',
  'gap_resolved_10',
  'gap_resolved_50',
  'week_streak',
  'month_streak',
  'team_builder',
  'compliance_expert'
);

-- User achievements table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type achievement_type NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_type)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User streaks table
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak"
  ON user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streak"
  ON user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Compliance maturity scores table
CREATE TABLE compliance_maturity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  assessments_score INTEGER NOT NULL DEFAULT 0,
  documentation_score INTEGER NOT NULL DEFAULT 0,
  proactivity_score INTEGER NOT NULL DEFAULT 0,
  team_score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE compliance_maturity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own maturity score"
  ON compliance_maturity_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own maturity score"
  ON compliance_maturity_scores FOR ALL
  USING (auth.uid() = user_id);

-- Team members table with role-based benefits
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DPO', 'CISO', 'Legal', 'Compliance Officer', 'Auditor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{"can_edit": true, "can_delete": false, "can_invite": false}'::jsonb,
  UNIQUE(team_owner_id, member_email)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team"
  ON team_members FOR SELECT
  USING (auth.uid() = team_owner_id OR auth.uid() = member_user_id);

CREATE POLICY "Team owners can manage team"
  ON team_members FOR ALL
  USING (auth.uid() = team_owner_id);

-- Team benefits tracking (for monetization)
CREATE TABLE team_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  team_size INTEGER NOT NULL DEFAULT 1,
  discount_percentage INTEGER NOT NULL DEFAULT 0,
  has_collaboration_features BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  has_advanced_analytics BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE team_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own benefits"
  ON team_benefits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own benefits"
  ON team_benefits FOR ALL
  USING (auth.uid() = user_id);

-- Document comments table
CREATE TABLE document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible documents"
  ON document_comments FOR SELECT
  USING (can_access_document(document_id));

CREATE POLICY "Authenticated users can create comments"
  ON document_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND can_access_document(document_id));

CREATE POLICY "Users can update own comments"
  ON document_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON document_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  new_regulations BOOLEAN NOT NULL DEFAULT true,
  compliance_deadlines BOOLEAN NOT NULL DEFAULT true,
  team_activity BOOLEAN NOT NULL DEFAULT true,
  weekly_insights BOOLEAN NOT NULL DEFAULT true,
  achievement_unlocked BOOLEAN NOT NULL DEFAULT true,
  email_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (email_frequency IN ('realtime', 'daily', 'weekly', 'never')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, CURRENT_DATE);
    RETURN;
  END IF;

  IF v_last_date = CURRENT_DATE THEN
    RETURN;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
  ELSE
    v_current_streak := 1;
  END IF;

  UPDATE user_streaks
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_activity_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to calculate and update team benefits
CREATE OR REPLACE FUNCTION update_team_benefits(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_size INTEGER;
  v_discount INTEGER;
  v_collab BOOLEAN;
  v_priority BOOLEAN;
  v_analytics BOOLEAN;
BEGIN
  SELECT COUNT(*) + 1 INTO v_team_size
  FROM team_members
  WHERE team_owner_id = p_user_id AND status = 'active';

  -- Benefits scaling
  v_discount := CASE
    WHEN v_team_size >= 10 THEN 30
    WHEN v_team_size >= 5 THEN 20
    WHEN v_team_size >= 3 THEN 10
    ELSE 0
  END;

  v_collab := v_team_size >= 2;
  v_priority := v_team_size >= 5;
  v_analytics := v_team_size >= 3;

  INSERT INTO team_benefits (
    user_id, team_size, discount_percentage,
    has_collaboration_features, has_priority_support, has_advanced_analytics
  )
  VALUES (p_user_id, v_team_size, v_discount, v_collab, v_priority, v_analytics)
  ON CONFLICT (user_id) DO UPDATE SET
    team_size = v_team_size,
    discount_percentage = v_discount,
    has_collaboration_features = v_collab,
    has_priority_support = v_priority,
    has_advanced_analytics = v_analytics,
    updated_at = now();
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_maturity_scores_updated_at
  BEFORE UPDATE ON compliance_maturity_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_comments_updated_at
  BEFORE UPDATE ON document_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();