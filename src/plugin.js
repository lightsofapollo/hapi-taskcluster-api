import * as Joi from 'joi';
import LRU from 'lru-cache';
import Client from './client';
import Boom from 'boom';

import toSchema from './schema';
import hawk from 'hawk';
import superagent from 'superagent';
import addHawk from 'superagent-hawk';

// Maximum number of clients.
const CACHE_CLIENTS = 256;
// Maximum age of cached client.
const CACHE_CLIENT_MAX_AGE = 1000 * 60 * 15;

let request = addHawk(superagent);

/**
Hapi plugin used to register auth/methods...
*/
export function register(server, opts = {}, next) {
  let validate = Joi.validate(opts, Joi.object().keys({
    credentials: Joi.object().keys({
      clientId: Joi.string().required(),
      accessToken: Joi.string().required()
    }),
    authBaseUrl: Joi.string().
      default('https://auth.taskcluster.net/v1').
      description('url for authentication server')
  }));

  if (validate.error) throw validate.error;
  opts = validate.value;

  // Fetching clients is potentially expensive so simple LRU can drasticly
  // improve response times...
  let clients = new LRU({
    max: CACHE_CLIENTS,
    maxAge: CACHE_CLIENT_MAX_AGE
  });

  // Client loader...
  let loader = function(id, callback) {
    let client = clients.get(id);
    if (client) {
      return process.nextTick(() => {
        callback(null, id);
      });
    }

    let url = `${opts.authBaseUrl}/client/${id}/credentials`;
    request.
      get(url).
      hawk({
        id: opts.credentials.clientId,
        key: opts.credentials.accessToken,
        algorithm: 'sha256'
      }).
      end(function(res) {
        if (res.error) return callback(res.error);
        let client = new Client(res.body);
        clients.set(id, client);
        callback(null, {
          key: res.body.accessToken,
          algorithm: 'sha256',
          client: client
        });
      });
  }

  // Validate any routes which require scopes
  server.ext('onPostAuth', (request, reply) => {
    // Only test routes which have been authenticated...
    if (!request.auth.isAuthenticated) {
      return reply.continue();
    }

    let client = request.auth.credentials.client;
    if (client.isExpired()) {
      return reply(Boom.forbidden(
        `Expired client (${client.clientId}) expired at ${client.expires.toJSON()}`
      ));
    }

    let taskcluster = request.route.settings.plugins.taskcluster || {};

    if (!taskcluster.scopes || !taskcluster.scopes.length) {
      return reply.continue();
    }

    if (!client.satisfies(taskcluster.scopes)) {
      let error = Boom.forbidden('Client has insufficient scopes');
      error.output.payload.clientScopes = client.scopes;
      error.output.payload.requiredScopesets = taskcluster.scopes;
      return reply(error);
    }

    reply.continue();
  });

  // Register the reference endpoint.
  server.route({
    method: 'get',
    path: '/reference',
    handler: (request, reply) => {
      reply(toSchema(server));
    }
  });

  // Register the hawk authentication plugin...
  server.register(
    [{
      register: require('hapi-auth-hawk'),
      options: {}
    }],
    (err) => {
      if (err) return next(err);
      server.auth.strategy('taskcluster', 'hawk', {
        getCredentialsFunc: loader
      });
      next();
    }
  );
};

register.attributes = {
  pkg: require('../package.json')
}
