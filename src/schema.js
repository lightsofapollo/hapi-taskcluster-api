/**
Utilities to convert a hapi server instance into reference schema.
*/


import joiToJsonSchema from 'joi-to-json-schema';

// See: https://github.com/taskcluster/taskcluster-base/blob/master/schemas/api-reference.json
export default function schema(server) {
  let schema = { version: '0.2.0' };
  let settings = server.settings.app;
  let serverDetails = server.table();


  // If the original server object is sent pick the first connection...
  if (Array.isArray(serverDetails)) {
    serverDetails = serverDetails[0];
  }

  schema.title = settings.title || '';
  schema.description = settings.description || '';
  schema.baseUrl = settings.baseUrl || serverDetails.info.uri;

  schema.entries = serverDetails.table.map((route) => {
    let params = [];
    let routeName = route.fingerprint;
    route.params.forEach((value) => {
      routeName = routeName.replace('?', `<${value}>`);
      params.push(value);
    });

    let taskclusterParams = route.settings.plugins.taskcluster || {} ;

    let entry = {
      type: 'function',
      method: route.method,
      route: routeName,
      args: params,
      description: (route.settings.description || '').trim(),
      title: taskclusterParams.title || '',
      name: taskclusterParams.name || ''
    };

    if (route.settings.validate.payload) {
      entry.input = joiToJsonSchema(route.settings.validate.payload);
    }

    if (route.settings.response && route.settings.response.schema) {
      entry.output = joiToJsonSchema(route.settings.response.schema);
    }

    if (taskclusterParams.scopes) {
      entry.scopes = taskclusterParams.scopes;
    }

    return entry;
  });

  return schema;
}
