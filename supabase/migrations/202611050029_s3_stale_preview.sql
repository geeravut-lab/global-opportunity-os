-- Authorized preview owner reaches the transaction barrier after a listing is paused/expired;
-- the submit RPC returns409 without exposing a current draft or creating partial shares.
create policy s3_preview_listing_barrier on app.opportunities for select to goos_api using(private.goos_s3_listing_transaction(id));
notify pgrst,'reload schema';
