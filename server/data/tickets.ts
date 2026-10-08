export interface TicketData {
  id: string;
  title: string;
  customer: string;
  category: 'Infrastructure' | 'Payments' | 'Authentication' | 'API' | 'Data';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  createdAt: string;
  description: string;
  slaMinutesRemaining: number;
  tags: string[];
}

export const INITIAL_TICKETS: TicketData[] = [
  {
    id: 'TICKET-101',
    title: 'Payment gateway timeout on checkout endpoint',
    customer: 'Acme Global Commerce',
    category: 'Payments',
    priority: 'Critical',
    createdAt: '8 mins ago',
    description: 'Stripe webhook listener reporting intermittent 504 timeouts when capturing multi-currency authorization hold.',
    slaMinutesRemaining: 12,
    tags: ['stripe', 'checkout', 'p0-blocker'],
  },
  {
    id: 'TICKET-102',
    title: 'PostgreSQL connection pool saturation during peak load',
    customer: 'FinScale Enterprise',
    category: 'Infrastructure',
    priority: 'Critical',
    createdAt: '15 mins ago',
    description: 'Active client connections reached maximum pool limit (98/100). PgBouncer idle connections not releasing promptly.',
    slaMinutesRemaining: 18,
    tags: ['postgres', 'pgbouncer', 'db-latency'],
  },
  {
    id: 'TICKET-103',
    title: 'SSO OAuth session validation token expiry anomaly',
    customer: 'HealthTech Systems',
    category: 'Authentication',
    priority: 'High',
    createdAt: '22 mins ago',
    description: 'Okta SAML assertion decoding throws invalid clock skew error for users authenticated in UTC-8 timezone.',
    slaMinutesRemaining: 38,
    tags: ['okta', 'saml', 'sso'],
  },
  {
    id: 'TICKET-104',
    title: 'Webhook retry storm causing downstream 504 Gateway Timeouts',
    customer: 'DeliverFast Logistics',
    category: 'API',
    priority: 'High',
    createdAt: '35 mins ago',
    description: 'Exponential backoff failed on partner integration endpoint; receiving 2,400 duplicate delivery status events/min.',
    slaMinutesRemaining: 45,
    tags: ['webhooks', 'rate-limiting', 'traffic-spike'],
  },
  {
    id: 'TICKET-105',
    title: 'Customer unable to export GDPR audit package',
    customer: 'Nordic Cloud GmbH',
    category: 'Data',
    priority: 'Medium',
    createdAt: '48 mins ago',
    description: 'Async worker zip generation task runs out of memory for workspaces with over 50,000 attachment records.',
    slaMinutesRemaining: 95,
    tags: ['gdpr', 'data-export', 'background-worker'],
  },
  {
    id: 'TICKET-106',
    title: 'Redis cache eviction thrashing on active user profiles',
    customer: 'StreamPulse Media',
    category: 'Infrastructure',
    priority: 'High',
    createdAt: '1 hour ago',
    description: 'Volatile-LRU policy evicting hot session keys prematurely under 85% memory threshold. Investigation needed.',
    slaMinutesRemaining: 60,
    tags: ['redis', 'caching', 'memory-pressure'],
  },
  {
    id: 'TICKET-107',
    title: 'Billing invoice PDF worker generating corrupted headers',
    customer: 'RetailChain Corp',
    category: 'Payments',
    priority: 'Medium',
    createdAt: '2 hours ago',
    description: 'Puppeteer rendering worker instances leaking Chrome headless processes resulting in truncated PDF downloads.',
    slaMinutesRemaining: 140,
    tags: ['billing', 'invoices', 'puppeteer'],
  },
  {
    id: 'TICKET-108',
    title: 'Search indexing lag exceeding 45 minutes on delta events',
    customer: 'OmniSearch Corp',
    category: 'Data',
    priority: 'Low',
    createdAt: '3 hours ago',
    description: 'Elasticsearch ingestion pipeline consumer lagging behind Kafka partition 4 offset by 18,200 messages.',
    slaMinutesRemaining: 210,
    tags: ['elasticsearch', 'kafka', 'search-index'],
  },
];
