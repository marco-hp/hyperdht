const test = require('brittle')
const { swarm } = require('./helpers')

test('stats are exposed', async function (t) {
  const testnet = await swarm(t, 2)
  const dht = testnet.createNode()

  // dht.stats is public API (hyperdht-stats and its consumers read these keys),
  // so removing or renaming one of them is a breaking change
  t.alike(dht.stats, {
    punches: { consistent: 0, random: 0, open: 0, tryLater: 0 },
    relaying: { attempts: 0, successes: 0, aborts: 0 },
    queries: { active: 0, total: 0 },
    requests: { active: 0, total: 0, responses: 0, timeouts: 0, retries: 0 },
    commands: {
      ping: { tx: 0, rx: 0 },
      pingNat: { tx: 0, rx: 0 },
      findNode: { tx: 0, rx: 0 },
      downHint: { tx: 0, rx: 0 }
    },
    socketPool: { socketsAdded: 0, socketsRemoved: 0 }
  })
})
