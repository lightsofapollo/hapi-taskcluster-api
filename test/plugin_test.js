import Hapi from 'hapi';

import plugin from '../src/plugin';
import { createMockAuthServer } from 'taskcluster-base/testing';
import superagent from 'superagent';
import addHawk from 'superagent-hawk';
import denodeify from 'denodeify';
import assert from 'assert';

let request = require('superagent-promise').wrap(addHawk(superagent));

suite('plugin', function() {
  let authServer, authUrl;

  suiteSetup(async function() {
    authServer = await createMockAuthServer({
      port: 0,
      clients: [
        {
          clientId: 'star',
          accessToken: 'star',
          scopes: ['*'],
          expires: new Date(2100, 1)
        },
        {
          clientId: 'one-scope',
          accessToken: 'one-scope',
          scopes: ['one:scope'],
          expires: new Date(2100, 1)
        },
        {
          clientId: 'valid',
          accessToken: 'valid',
          scopes: ['one:scope', 'one:valid'],
          expires: new Date(2100, 1)
        },
        {
          clientId: 'substar',
          accessToken: 'substar',
          scopes: ['one:*'],
          expires: new Date(2100, 1)
        },
        {
          clientId: 'alternate',
          accessToken: 'alternate',
          scopes: ['one:*'],
          expires: new Date(2100, 1)
        },
        {
          clientId: 'expired',
          accessToken: 'expired',
          scopes: ['one:*'],
          expires: new Date(1990, 1)
        }
      ]
    });

    let addr = authServer.address();
    authUrl = `http://${addr.address}:${addr.port}`
  });

  let server;
  suiteSetup(async function() {
    server = new Hapi.Server({
      debug: {
        log: ['ops', 'response'],
        request: ['ops', 'response', 'auth']
      }
    });
    server.connection();

    await denodeify(server.register).call(server, [
      {
        register: plugin,
        options: {
          authBaseUrl: `${authUrl}/v1`,
          credentials: {
            accessToken: 'star',
            clientId: 'star'
          }
        },
      }
    ]);

    server.route({
      method: 'POST',
      path: '/do',
      handler: function(request, reply) {
        reply({ woot: true });
      },
      config: {
        auth: 'taskcluster',
        plugins: {
          taskcluster: {
            name: 'do',
            scopes: [
              ['one:scope', 'one:valid'],
              'alternate'
            ]
          }
        }
      }
    });

    await denodeify(server.start).call(server);
  });

  async function req(clientId, accessToken) {
    return await request.
      post(`${server.info.uri}/do`).
      hawk({
        id: clientId,
        key: accessToken,
        algorithm: 'sha256'
      }).
      end();
  }

  test('auth', async function() {
    let starRes = await req('star', 'star');
    assert.ok(starRes.ok, starRes.error);

    let insufficentScopes = await req('one-scope', 'one-scope');
    assert.ok(!insufficentScopes.ok, insufficentScopes.error);
    assert.equal(insufficentScopes.status, 403);

    let expired = await req('expired', 'expired');
    assert.ok(!expired.ok, expired.error);
    assert.equal(expired.statusCode, 403);

    let valid = await req('valid', 'valid');
    assert.ok(valid.ok);
    assert.deepEqual(valid.body, { woot: true });

    let substar = await req('substar', 'substar');
    assert.ok(substar.ok);
    assert.deepEqual(substar.body, { woot: true });
  });

  test('GET /reference', async function() {
    let reference = await request.get(`${server.info.uri}/reference`).end();
    console.log(reference.body);
    assert.ok(reference.body.entries.length === 1);
    let entry = reference.body.entries[0];
    assert.equal(entry.name, 'do');
  });

});
