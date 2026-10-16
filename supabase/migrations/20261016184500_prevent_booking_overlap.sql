-- EDM28 booking integrity: prevent overlapping provisional reservations and appointments.
-- Retain historical data; cancelled and expired holds do not block bookings.
CREATE OR REPLACE FUNCTION private.edm28_guard_booking_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF new.status NOT IN ('held', 'review_pending', 'confirmed')
     OR (new.status = 'held' AND new.expires_at <= now()) THEN
    RETURN new;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('edm28-booking'));

  IF EXISTS (
    SELECT 1 FROM public.booking_reservations b
    WHERE b.id <> new.id
      AND (b.status IN ('review_pending', 'confirmed')
        OR (b.status = 'held' AND b.expires_at > now()))
      AND b.starts_at < new.ends_at + interval '30 minutes'
      AND new.starts_at < b.ends_at + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'Ce créneau est déjà réservé.'
      USING ERRCODE='23P01', CONSTRAINT='edm28_booking_slot_taken';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.status <> 'cancelled'
      AND a.id IS DISTINCT FROM new.appointment_id
      AND a.external_appointment_id IS DISTINCT FROM 'reservation/' || new.id::text
      AND a.starts_at < new.ends_at + interval '30 minutes'
      AND new.starts_at < coalesce(a.ends_at, a.starts_at + interval '1 hour')
                        + make_interval(mins => coalesce(a.buffer_minutes, 30))
  ) THEN
    RAISE EXCEPTION 'Ce créneau chevauche un rendez-vous existant.'
      USING ERRCODE='23P01', CONSTRAINT='edm28_booking_existing_appointment';
  END IF;

  RETURN new;
END;
$function$

CREATE OR REPLACE FUNCTION private.edm28_guard_booking_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF new.status = 'cancelled' THEN
    RETURN new;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('edm28-booking'));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> new.id
      AND a.status <> 'cancelled'
      AND a.starts_at < coalesce(new.ends_at, new.starts_at + interval '1 hour')
                        + make_interval(mins => coalesce(new.buffer_minutes, 30))
      AND new.starts_at < coalesce(a.ends_at, a.starts_at + interval '1 hour')
                        + make_interval(mins => coalesce(a.buffer_minutes, 30))
  ) THEN
    RAISE EXCEPTION 'Ce créneau chevauche un autre rendez-vous.'
      USING ERRCODE='23P01', CONSTRAINT='edm28_appointment_slot_taken';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.booking_reservations b
    WHERE (b.status IN ('review_pending', 'confirmed')
           OR (b.status = 'held' AND b.expires_at > now()))
      AND b.appointment_id IS DISTINCT FROM new.id
      AND new.external_appointment_id IS DISTINCT FROM 'reservation/' || b.id::text
      AND b.starts_at < coalesce(new.ends_at, new.starts_at + interval '1 hour')
                        + make_interval(mins => coalesce(new.buffer_minutes, 30))
      AND new.starts_at < b.ends_at + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'Ce créneau est déjà pré-réservé.'
      USING ERRCODE='23P01', CONSTRAINT='edm28_appointment_existing_booking';
  END IF;

  RETURN new;
END;
$function$

REVOKE ALL ON FUNCTION private.edm28_guard_booking_reservation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.edm28_guard_booking_appointment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS edm28_guard_booking_reservation ON public.booking_reservations;
CREATE TRIGGER edm28_guard_booking_reservation BEFORE INSERT OR UPDATE OF id, quote_id, user_id, vehicle_id, starts_at, ends_at, status, expires_at, appointment_id ON public.booking_reservations FOR EACH ROW EXECUTE FUNCTION private.edm28_guard_booking_reservation();
DROP TRIGGER IF EXISTS edm28_guard_booking_appointment ON public.appointments;
CREATE TRIGGER edm28_guard_booking_appointment BEFORE INSERT OR UPDATE OF id, user_id, vehicle_id, starts_at, ends_at, status, buffer_minutes, external_appointment_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION private.edm28_guard_booking_appointment();
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='edm28_appointments_no_overlap') THEN
ALTER TABLE public.appointments ADD CONSTRAINT edm28_appointments_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status<>'cancelled' AND ends_at IS NOT NULL);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.booking_reservations'::regclass AND conname='edm28_bookings_no_overlap') THEN
ALTER TABLE public.booking_reservations ADD CONSTRAINT edm28_bookings_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('review_pending','confirmed'));
END IF;
END $$;
