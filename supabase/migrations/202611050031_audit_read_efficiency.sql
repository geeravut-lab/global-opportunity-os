-- Audit authorization is constant for one statement; evaluate current role/MFA once,
-- preserve deny-by-default RLS and append-only history while avoiding a role check per row.
alter policy audit_platform_read on private.audit_events using ((select private.goos_platform_admin()));
create index audit_recent on private.audit_events(occurred_at desc);
