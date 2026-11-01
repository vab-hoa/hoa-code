-- Drop the denormalized owner columns from properties.
--
-- Apply this only after tracker.villasboulders.org is serving the dashboard
-- that reads owners from people + contacts. The previous directory route
-- selects owner_name, owner_email, and owner_phone; dropping them first
-- breaks that deployment.
--
-- Live dependents (checked 2026-11-01): v_open_work_items and v_aging_work_items.
-- No functions reference the columns. CREATE OR REPLACE VIEW cannot remove a
-- column, so the views are dropped and recreated from the live definitions
-- with p.owner_name removed. The aging view uses status_changed_at; do not
-- substitute the older schema_v4.sql text.
--
-- homeowner_name on snapshots and email parses is a different column. Leave it.

BEGIN;

DROP VIEW IF EXISTS public.v_open_work_items;
DROP VIEW IF EXISTS public.v_aging_work_items;

CREATE VIEW public.v_open_work_items AS
 SELECT wi.id,
    wi.title,
    wi.category,
    wi.status,
    wi.priority,
    wi.assigned_to,
    wi.vendor,
    wi.estimated_cost,
    wi.bid_amount,
    wi.created_date,
    wi.due_date,
    wi.scheduled_date,
    wi.decision,
    wi.decision_rationale,
    wi.decision_by,
    wi.decision_at,
    p.parcel_code,
    p.address
   FROM work_items wi
     LEFT JOIN properties p ON wi.property_id = p.id
  WHERE (wi.status <> ALL (ARRAY['closed'::text, 'cancelled'::text, 'denied'::text])) AND wi.excluded_at IS NULL
  ORDER BY wi.priority DESC, wi.updated_date DESC;

CREATE VIEW public.v_aging_work_items AS
 SELECT wi.id,
    wi.title,
    wi.category,
    wi.status,
    p.parcel_code,
    p.address,
    wi.status_changed_at,
    a.max_days,
    EXTRACT(epoch FROM now() - wi.status_changed_at) / 86400::numeric AS days_open,
    wi.assigned_to,
    wi.vendor,
    wi.created_date
   FROM work_items wi
     JOIN aging_config a ON a.category = wi.category AND a.status = wi.status
     LEFT JOIN properties p ON wi.property_id = p.id
  WHERE (wi.status <> ALL (ARRAY['closed'::text, 'approved'::text, 'approved_with_conditions'::text, 'denied'::text, 'withdrawn'::text, 'resolved'::text, 'fined'::text])) AND wi.status !~~ 'project:%'::text AND wi.excluded_at IS NULL AND (EXTRACT(epoch FROM now() - wi.status_changed_at) / 86400::numeric) > a.max_days::numeric
  ORDER BY (EXTRACT(epoch FROM now() - wi.status_changed_at) / 86400::numeric) DESC;

GRANT ALL ON public.v_open_work_items TO anon, authenticated, service_role;
GRANT ALL ON public.v_aging_work_items TO anon, authenticated, service_role;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS owner_name,
  DROP COLUMN IF EXISTS owner_email,
  DROP COLUMN IF EXISTS owner_phone;

COMMIT;
