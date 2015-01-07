import * as Joi from 'joi';
import scopes from './scopes';

export default class Client {
  constructor(options = {}) {
    let validate = Joi.validate(options, Joi.object().keys({
      clientId: Joi.string().required(),
      accessToken: Joi.string().required(),
      scopes: Joi.array().required(),
      expires: Joi.date().required()
    }).unknown(false));

    if (validate.error) throw validate.error;
    Object.assign(this, validate.value);
  }

  /** Check if the client satisfies any of the given scope-sets */
  satisfies(scopesets) {
   return scopes.matches(this.scopes, scopesets);
  }

  /** Check if client credentials are expired */
  isExpired() {
    return this.expires < (new Date());
  }
}
