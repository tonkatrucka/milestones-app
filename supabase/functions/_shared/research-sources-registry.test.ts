import { assertEquals } from 'jsr:@std/assert';
import { inferSourceTier, inferSourceRegion } from './research-source-policy.ts';
import { isDomainOnAllowlist } from './research-sources-registry.ts';

Deno.test('Australian flagship sources are on allowlist', () => {
  for (const domain of [
    'raisingchildren.net.au',
    'healthdirect.gov.au',
    'pregnancybirthbaby.org.au',
    'startingblocks.gov.au',
  ]) {
    assertEquals(isDomainOnAllowlist(domain), true);
    assertEquals(inferSourceTier(domain), 'tier_1');
    assertEquals(inferSourceRegion(domain), 'AU');
  }
});

Deno.test('Ireland and New Zealand health domains are tier 1', () => {
  assertEquals(inferSourceTier('hse.ie'), 'tier_1');
  assertEquals(inferSourceTier('healthnz.govt.nz'), 'tier_1');
  assertEquals(isDomainOnAllowlist('www.tewhatuora.govt.nz'), true);
});

Deno.test('NHS inform Scotland is tier 1 UK', () => {
  assertEquals(inferSourceTier('nhsinform.scot'), 'tier_1');
  assertEquals(inferSourceRegion('nhsinform.scot'), 'UK');
});

Deno.test('commercial and blog domains are rejected', () => {
  assertEquals(isDomainOnAllowlist('wikipedia.org'), false);
  assertEquals(isDomainOnAllowlist('bbc.co.uk'), false);
  assertEquals(isDomainOnAllowlist('amazon.com'), false);
});
