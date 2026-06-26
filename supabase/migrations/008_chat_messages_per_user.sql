-- Scope assistant chat history to the signed-in user (not shared across child members).

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Existing rows were created by the child owner before per-user chat existed.
UPDATE public.chat_messages cm
SET user_id = c.created_by
FROM public.children c
WHERE cm.child_id = c.id
  AND cm.user_id IS NULL;

ALTER TABLE public.chat_messages
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS chat_messages_child_user_created_idx
  ON public.chat_messages (child_id, user_id, created_at DESC);

DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON public.chat_messages;

CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT USING (
    user_id = auth.uid()
    AND child_id IN (
      SELECT child_id FROM public.child_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY "chat_messages_delete" ON public.chat_messages
  FOR DELETE USING (
    user_id = auth.uid()
    AND child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
