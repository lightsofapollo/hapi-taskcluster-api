import Hapi from 'hapi';
import * as Joi from 'joi';
import denodeify from 'denodeify';
import request from 'superagent-promise';
import assert from 'assert';

import plugin from '../src/plugin';
import createSchema from '../src/schema';
import { createClient } from 'taskcluster-client';

suite('schema', function() {
  let server, url;

  function routes(server) {
    server.route({
      method: 'GET',
      path: '/info',
      handler: function(request, reply) {
        reply({ info: 'info' });
      },
      config: {
        description: 'Info',
        notes: `some details about info`,
        plugins: {
          taskcluster: {
            name: 'getInfo'
          }
        },
        response: {
          schema: Joi.object().keys({
            info: Joi.string().description('get info')
          })
        }
      }
    });

    server.route({
      method: 'POST',
      path: '/api/{version}/{name}',
      handler: function(request, reply) {
        reply({
          input: request.payload.input,
          version: request.params.version,
          name: request.params.name
        });
      },
      config: {
        description: 'Title',
        notes: 'api thing',
        plugins: {
          taskcluster: {
            name: 'doApiVersion',
            scopes: ['woot']
          }
        },
        response: {
          schema: Joi.object().keys({
            input: Joi.string().description('input'),
            version: Joi.string().description('version'),
            name: Joi.string().description('name')
          })
        },
        validate: {
          payload: Joi.object().keys({
            input: Joi.string().required().description('input desc')
          }),
          params: Joi.object().keys({
            version: Joi.string().description('version desc'),
            name: Joi.string().description('name desc')
          })
        }
      }
    });

    server.route({
      method: 'POST',
      path: '/postme',
      handler: function(request, reply) {
        reply({ woot: 'yay' });
      },
      config: {
        description: 'Post me endpoint',
        notes: `
          The postme endpoint does things
        `,
        response: {
          schema: Joi.object().keys({
            woot: Joi.string()
          })
        },
        validate: {},
        plugins: {
          taskcluster: {
            name: 'postMe',
            scopes: [['test:postme', 'test:post']]
          }
        }
      }
    });
  }

  setup(async function() {
    server = new Hapi.Server({
      app: {
        title: 'Server title',
        description: 'Server description'
      }
    });

    server.connection({ port: 0 });

    await denodeify(server.register).call(server, [{
      register: plugin,
      options: {}
    }]);

    routes(server);
    await denodeify(server.start).call(server);
    url = `http://${server.info.address}:${server.info.port}`;
  });

  suite('using schema with client', function() {
    let schema, Client, client;
    setup(function() {
      schema = createSchema(server);
      Client = createClient(schema);
      client = new Client({
        credentials: {
          clientId: 'id',
          accessToken: 'token'
        }
      });
    });

    test('schema output', function() {
      Joi.assert(schema, Joi.object().keys({
        title: Joi.string().valid(server.settings.app.title),
        description: Joi.string().valid(server.settings.app.description),
        version: Joi.string().valid('0.2.0'),
        baseUrl: Joi.string().valid(server.info.uri),
        entries: Joi.array()
      }));
    });

    test('calling apis', async function() {
      let info = await client.getInfo();
      assert.deepEqual(info, { info: 'info' });

      let api = await client.doApiVersion('1.0', 'name', {
        input: 'input'
      });

      assert.deepEqual(api, {
        version: '1.0',
        name: 'name',
        input: 'input'
      });
    });
  });
});
