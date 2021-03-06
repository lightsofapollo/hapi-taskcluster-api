/**
Utilities to convert a hapi server instance into reference schema.
*/


import joiToJsonSchema from 'joi-to-json-schema';

// See: https://github.com/taskcluster/taskcluster-base/blob/master/schemas/api-reference.json
export default function schema(server) {
  let schema = { version: '0.2.0' };
  let settings = server.settings.app || {};
  let serverDetails = server.table();


  // If the original server object is sent pick the first connection...
  if (Array.isArray(serverDetails)) {
    serverDetails = serverDetails[0];
  }

  schema.title = settings.title || '';
  schema.description = settings.description || '';
  schema.baseUrl = settings.baseUrl || serverDetails.info.uri;

  schema.entries = [];

  serverDetails.table.forEach((route) => {
    let settings = route.settings;
    let taskclusterParams = settings.plugins.taskcluster || {} ;

    // Only generate definitions for things with names...
    if (!taskclusterParams.name) return;

    let params = [];
    let routeName = route.fingerprint;
    route.params.forEach((value) => {
      routeName = routeName.replace('?', `<${value}>`);
      params.push(value);
    });

    let entry = {
      type: 'function',
      method: route.method,
      route: routeName,
      args: params,
      title: (settings.description || '').trim(),
      description: (settings.notes || '').trim(),
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

    return schema.entries.push(entry);
  });

  return schema;
}
