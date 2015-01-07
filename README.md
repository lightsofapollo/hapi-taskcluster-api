# hapi-taskcluster-api

Hapi + Taskcluster API Tools/Schema/Validation (http endpoints only).

This is primarily a proof of concept/prototype of using taskcluster +
hapi for server side components (including reference generation).

In addition to the usual scope/hawk authentication a '/reference'
endpoint is generated which will return the reference format which can
be consumed by the `taskcluster-client`'s `createClient` method.

## Example

See the [/test](tests) for the full sets of examples but the most basic
configuration would look like this:

```js
var hapi = require('hapi');
var server = new hapi.Server();

server.register({
  register: require('hapi-taskcluster-api'),
  options: {
    // Taskcluster credentials...
    credentials: {
      clientId: '...',
      accessToken: '...',
    }
  }
});

server.route({
  method: 'post',
  path: '/do'
  handler: function(request, reply) {
    // ...
  },
  config: {
    description: 'Do'
    notes: 'Do things',
    auth: 'taskcluster', // require taskcluster hawk pass
    plugins: {
      taskcluster: {
        name: 'aliasInClientAutoGen',
        scopes: ['do']
      }
    }
  }
});
```
