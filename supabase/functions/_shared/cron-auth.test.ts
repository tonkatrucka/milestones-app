import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isAuthorizedMaintenanceRequest } from './cron-auth.ts';

const SERVICE_ROLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkyMDAwMDAwMH0.signature';
const ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MjAwMDAwMDB9.signature';

Deno.test('cron secret authorizes maintenance request', () => {
  assertEquals(
    isAuthorizedMaintenanceRequest('', 'secret', 'secret', ''),
    true,
  );
});

Deno.test('service_role jwt authorizes maintenance request', () => {
  assertEquals(
    isAuthorizedMaintenanceRequest(`Bearer ${SERVICE_ROLE_JWT}`, '', '', ''),
    true,
  );
});

Deno.test('anon jwt is rejected', () => {
  assertEquals(
    isAuthorizedMaintenanceRequest(`Bearer ${ANON_JWT}`, '', '', 'other-key'),
    false,
  );
});

Deno.test('exact service role key match authorizes', () => {
  assertEquals(
    isAuthorizedMaintenanceRequest('Bearer my-key', '', '', 'my-key'),
    true,
  );
});
