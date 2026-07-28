const test = require('brittle')
const Nat = require('../lib/nat')
const { FIREWALL } = require('../lib/constants')

test('firewall - open', function (t) {
  const nat = new Nat({ firewalled: false }, null, null)

  t.is(nat.sampled, 0)
  t.is(nat.firewall, FIREWALL.OPEN)
})

// Regression: dht-rpc re-checks whether we are firewalled on a background timer,
// independent of any in-flight holepunch. If that check resolves (firewalled:
// true -> false) before any nat samples have come in, the firewall flips
// straight to OPEN with zero samples collected. _updateAddresses() must still
// hand back a usable address for that case, otherwise the peer we're
// holepunching with can never find a remoteVerifiedAddress and permanently
// fails Holepuncher.punch()
test('firewall - open after mid-flight flip still exposes an address', function (t) {
  const dht = {
    firewalled: true,
    remoteAddress() {
      return { host: '203.0.113.5', port: 44201 }
    }
  }

  const nat = new Nat(dht, null, null)

  t.is(nat.sampled, 0)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  // The background self-check resolves: we are not firewalled after all.
  // No samples have arrived yet - this is the exact race.
  dht.firewalled = false
  nat.update()

  t.is(nat.firewall, FIREWALL.OPEN)
  t.alike(
    nat.addresses,
    [{ host: '203.0.113.5', port: 44201, hits: 1 }],
    'an OPEN nat must still expose an address, or holepunch() can never find a remoteVerifiedAddress'
  )
})

test('firewall - random', function (t) {
  const nat = new Nat({ firewalled: true }, null, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1, 'only one sample per referrer')
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8081 }, { host: '127.0.0.1', port: 8081 })
  t.is(nat.sampled, 2)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8082 }, { host: '127.0.0.1', port: 8082 })
  t.is(nat.sampled, 3)
  t.is(nat.firewall, FIREWALL.RANDOM)
  t.alike(nat.addresses, [{ host: '127.0.0.1', port: 0, hits: 3 }])
})

test('firewall - consistent', function (t) {
  const nat = new Nat({ firewalled: true }, null, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8081 })
  t.is(nat.sampled, 2)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8082 })
  t.is(nat.sampled, 3)
  t.is(nat.firewall, FIREWALL.CONSISTENT)
  t.alike(nat.addresses, [{ host: '127.0.0.1', port: 8080, hits: 3 }])
})

test('firewall - consistent with another sample', function (t) {
  const nat = new Nat({ firewalled: true }, null, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8081 }, { host: '127.0.0.1', port: 8081 })
  t.is(nat.sampled, 2)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8082 })
  t.is(nat.sampled, 3)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8083 })
  t.is(nat.sampled, 4)
  t.is(nat.firewall, FIREWALL.CONSISTENT)
  t.alike(nat.addresses, [
    { host: '127.0.0.1', port: 8080, hits: 3 },
    { host: '127.0.0.1', port: 8081, hits: 1 }
  ])
})

test('firewall - double consistent', function (t) {
  const nat = new Nat({ firewalled: true }, null, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.2', port: 8081 }, { host: '127.0.0.1', port: 8081 })
  t.is(nat.sampled, 2)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8082 })
  t.is(nat.sampled, 3)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.2', port: 8081 }, { host: '127.0.0.1', port: 8083 })
  t.is(nat.sampled, 4)
  t.is(nat.firewall, FIREWALL.CONSISTENT)
  t.alike(nat.addresses, [
    { host: '127.0.0.1', port: 8080, hits: 2 },
    { host: '127.0.0.2', port: 8081, hits: 2 }
  ])
})

test('firewall - not quite consistent', function (t) {
  const nat = new Nat({ firewalled: true }, null, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8080 })
  t.is(nat.sampled, 1)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8080 }, { host: '127.0.0.1', port: 8081 })
  t.is(nat.sampled, 2)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8081 }, { host: '127.0.0.1', port: 8082 })
  t.is(nat.sampled, 3)
  t.is(nat.firewall, FIREWALL.UNKNOWN)
  t.is(nat.addresses, null)

  nat.add({ host: '127.0.0.1', port: 8082 }, { host: '127.0.0.1', port: 8083 })
  t.is(nat.sampled, 4)
  t.is(nat.firewall, FIREWALL.RANDOM)
  t.alike(nat.addresses, [{ host: '127.0.0.1', port: 0, hits: 4 }])
})
