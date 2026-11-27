// Addresses shared by the lessons. IPs come from private and documentation
// ranges (RFC 1918 / RFC 5737); MACs from the documentation range (RFC 7042).
// The root and .com server addresses are the real, public ones.

export const MAC = {
  client: '00:00:5e:00:53:14',
  router: '00:00:5e:00:53:01',
  hostB: '00:00:5e:00:53:1e',
  printer: '00:00:5e:00:53:28',
  phone: '00:00:5e:00:53:32',
  resolver: '00:00:5e:00:53:35',
  resolverGw: '00:00:5e:00:53:fe',
  broadcast: 'ff:ff:ff:ff:ff:ff',
  none: '00:00:00:00:00:00',
}

export const IP = {
  client: '192.168.0.20',
  router: '192.168.0.1',
  hostB: '192.168.0.30',
  printer: '192.168.0.40',
  phone: '192.168.0.50',
  resolver: '192.0.2.53',
  root: '198.41.0.4',
  tld: '192.5.6.30',
  auth: '203.0.113.53',
  web: '198.51.100.80',
  echo: '198.51.100.7',
  isp: '203.0.113.1',
}
