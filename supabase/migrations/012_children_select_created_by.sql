-- Allow creators to read children they insert (INSERT ... RETURNING) and any
-- child they created, without relying solely on child_members visibility timing.
DROP POLICY IF EXISTS "children_select" ON public.children;

CREATE POLICY "children_select" ON public.children
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );
