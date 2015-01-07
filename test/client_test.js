import Client from '../src/client';
import assert from 'assert';

suite('client', function() {

  let createClient = (scopes=['*'], expires=new Date(2200, 0)) => {
    return new Client({
      clientId: 'id',
      accessToken: 'token',
      scopes,
      expires
    });
  };

  test('satisfied()', function() {
    assert.ok(createClient(['*']).satisfies(['a', 'b']), '* scope');
    assert.ok(createClient(['a', 'b']).satisfies([
      'a',
      'b'
    ]), 'two scopes');

    assert.ok(!createClient(['a']).satisfies([
      ['a', 'b']
    ]), 'missing item in scopeset');

    assert.ok(createClient(['a', 'b']).satisfies([
      ['a', 'b']
    ]), 'all items in scopesets');

    assert.ok(createClient(['foo']).satisfies([
      ['a', 'b'],
      ['foo']
    ]), 'alternate scopeset');

    assert.ok(createClient(['scope:*']).satisfies([
      ['scope:a', 'scope:b'],
      ['foo']
    ]), 'sub star');
  });

  test('isExpired()', function() {
    let expired = createClient(['*'], new Date(1900, 0));
    let inFuture = createClient(['*'], new Date(2200, 0));

    assert.ok(expired.isExpired(), 'expired');
    assert.ok(!inFuture.isExpired(), 'not expired');
  });

});
