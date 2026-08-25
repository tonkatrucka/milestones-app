-- Journey engagement: reactions, comments, privacy, monthly recaps,
-- digest followers, share links, time capsules, first words, teeth log.
--
-- Idempotent so a failed apply (e.g. missing pgcrypto) can be re-run.
-- gen_random_bytes lives in pgcrypto; on hosted Supabase that extension
-- is often in the `extensions` schema and not on the default search_path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO public, extensions;

-- ─── is_private on milestones and memories ────────────────────────────────────

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- ─── Audio notes on milestones and memories ───────────────────────────────────
-- Stored as a Supabase Storage path in the milestone-media bucket.

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS audio_url text;

-- ─── In-app reactions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestone_reactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (milestone_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.memory_reactions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (memory_id, user_id)
);

-- ─── In-app comments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestone_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         text NOT NULL CHECK (length(body) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memory_comments (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body      text NOT NULL CHECK (length(body) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_reactions_milestone_idx ON public.milestone_reactions(milestone_id);
CREATE INDEX IF NOT EXISTS memory_reactions_memory_idx ON public.memory_reactions(memory_id);
CREATE INDEX IF NOT EXISTS milestone_comments_milestone_idx ON public.milestone_comments(milestone_id);
CREATE INDEX IF NOT EXISTS memory_comments_memory_idx ON public.memory_comments(memory_id);

-- ─── RLS for reactions and comments ──────────────────────────────────────────

ALTER TABLE public.milestone_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_comments     ENABLE ROW LEVEL SECURITY;

-- All child members can read; any member can react/comment

DROP POLICY IF EXISTS milestone_reactions_select ON public.milestone_reactions;
CREATE POLICY milestone_reactions_select ON public.milestone_reactions
  FOR SELECT USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS milestone_reactions_insert ON public.milestone_reactions;
CREATE POLICY milestone_reactions_insert ON public.milestone_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS milestone_reactions_delete ON public.milestone_reactions;
CREATE POLICY milestone_reactions_delete ON public.milestone_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS memory_reactions_select ON public.memory_reactions;
CREATE POLICY memory_reactions_select ON public.memory_reactions
  FOR SELECT USING (
    memory_id IN (
      SELECT m.id FROM public.memories m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS memory_reactions_insert ON public.memory_reactions;
CREATE POLICY memory_reactions_insert ON public.memory_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    memory_id IN (
      SELECT m.id FROM public.memories m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS memory_reactions_delete ON public.memory_reactions;
CREATE POLICY memory_reactions_delete ON public.memory_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS milestone_comments_select ON public.milestone_comments;
CREATE POLICY milestone_comments_select ON public.milestone_comments
  FOR SELECT USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS milestone_comments_insert ON public.milestone_comments;
CREATE POLICY milestone_comments_insert ON public.milestone_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS milestone_comments_delete ON public.milestone_comments;
CREATE POLICY milestone_comments_delete ON public.milestone_comments
  FOR DELETE USING (
    auth.uid() = user_id OR
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      WHERE m.child_id IN (
        SELECT child_id FROM public.child_members WHERE user_id = auth.uid() AND role = 'owner'
      )
    )
  );

DROP POLICY IF EXISTS memory_comments_select ON public.memory_comments;
CREATE POLICY memory_comments_select ON public.memory_comments
  FOR SELECT USING (
    memory_id IN (
      SELECT m.id FROM public.memories m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS memory_comments_insert ON public.memory_comments;
CREATE POLICY memory_comments_insert ON public.memory_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    memory_id IN (
      SELECT m.id FROM public.memories m
      WHERE m.child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS memory_comments_delete ON public.memory_comments;
CREATE POLICY memory_comments_delete ON public.memory_comments
  FOR DELETE USING (
    auth.uid() = user_id OR
    memory_id IN (
      SELECT m.id FROM public.memories m
      WHERE m.child_id IN (
        SELECT child_id FROM public.child_members WHERE user_id = auth.uid() AND role = 'owner'
      )
    )
  );

-- ─── Monthly recap AI narratives ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.monthly_recaps (
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  month_key     text NOT NULL,   -- 'YYYY-MM' format
  narrative     text NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, month_key)
);

ALTER TABLE public.monthly_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_recaps_select ON public.monthly_recaps;
CREATE POLICY monthly_recaps_select ON public.monthly_recaps
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

-- ─── Email digest followers (Tier 2 family access) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.digest_followers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  email           text NOT NULL,
  display_name    text,
  added_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active       boolean NOT NULL DEFAULT true,
  frequency       text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  content_filter  text NOT NULL DEFAULT 'all' CHECK (content_filter IN ('all', 'milestones_only', 'no_photos')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, email)
);

CREATE TABLE IF NOT EXISTS public.digest_reactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id     uuid NOT NULL,
  content_type   text NOT NULL CHECK (content_type IN ('milestone', 'memory')),
  reactor_email  text NOT NULL,
  emoji          text NOT NULL,
  reacted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digest_followers_child_idx ON public.digest_followers(child_id);
CREATE INDEX IF NOT EXISTS digest_reactions_content_idx ON public.digest_reactions(content_id);

ALTER TABLE public.digest_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS digest_followers_owner ON public.digest_followers;
CREATE POLICY digest_followers_owner ON public.digest_followers
  FOR ALL USING (
    child_id IN (
      SELECT child_id FROM public.child_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- digest_reactions are written by the service role (edge function); no client policy needed

-- ─── Magic share links (Tier 3 family access) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.share_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  content_id    uuid NOT NULL,
  content_type  text NOT NULL CHECK (content_type IN ('milestone', 'memory')),
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  view_count    int NOT NULL DEFAULT 0,
  max_views     int NOT NULL DEFAULT 30,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS share_links_token_idx ON public.share_links(token);
CREATE INDEX IF NOT EXISTS share_links_owner_idx ON public.share_links(created_by, child_id);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS share_links_owner ON public.share_links;
CREATE POLICY share_links_owner ON public.share_links
  FOR ALL USING (auth.uid() = created_by);

-- ─── First words dictionary ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.first_words (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  word         text NOT NULL,
  phonetic     text,         -- how they actually say it (e.g. 'baba' = bottle)
  said_at      date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS first_words_child_idx ON public.first_words(child_id, said_at DESC);

ALTER TABLE public.first_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS first_words_select ON public.first_words;
CREATE POLICY first_words_select ON public.first_words
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS first_words_insert ON public.first_words;
CREATE POLICY first_words_insert ON public.first_words
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
DROP POLICY IF EXISTS first_words_update ON public.first_words;
CREATE POLICY first_words_update ON public.first_words
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
DROP POLICY IF EXISTS first_words_delete ON public.first_words;
CREATE POLICY first_words_delete ON public.first_words
  FOR DELETE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

-- ─── Time capsule ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_capsules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         text NOT NULL,
  media_urls   text[] NOT NULL DEFAULT '{}',
  audio_url    text,
  unlock_at    date NOT NULL,             -- specific date to unlock
  unlocked_at  timestamptz,               -- set when the capsule is first opened
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_capsules_child_idx ON public.time_capsules(child_id, unlock_at);

ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS time_capsules_select ON public.time_capsules;
CREATE POLICY time_capsules_select ON public.time_capsules
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
    AND (unlock_at <= CURRENT_DATE OR auth.uid() = created_by)
  );
DROP POLICY IF EXISTS time_capsules_insert ON public.time_capsules;
CREATE POLICY time_capsules_insert ON public.time_capsules
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
DROP POLICY IF EXISTS time_capsules_update ON public.time_capsules;
CREATE POLICY time_capsules_update ON public.time_capsules
  FOR UPDATE USING (auth.uid() = created_by AND unlocked_at IS NULL);
DROP POLICY IF EXISTS time_capsules_delete ON public.time_capsules;
CREATE POLICY time_capsules_delete ON public.time_capsules
  FOR DELETE USING (auth.uid() = created_by);

-- ─── Developmental checklist responses ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dev_checklist (
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  checkpoint_id text NOT NULL,
  status       text NOT NULL DEFAULT 'not_yet' CHECK (status IN ('yes', 'not_yet', 'not_sure')),
  noted_at     date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  PRIMARY KEY (child_id, checkpoint_id)
);

ALTER TABLE public.dev_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_checklist_select ON public.dev_checklist;
CREATE POLICY dev_checklist_select ON public.dev_checklist
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS dev_checklist_upsert ON public.dev_checklist;
CREATE POLICY dev_checklist_upsert ON public.dev_checklist
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
DROP POLICY IF EXISTS dev_checklist_update ON public.dev_checklist;
CREATE POLICY dev_checklist_update ON public.dev_checklist
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
