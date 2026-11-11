import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './clientMessage.js';

describe('parseClientMessage', () => {
  it('passes a well-formed message through', () => {
    expect(parseClientMessage('{"t":"join","roomId":"ABC","displayName":"Al","secret":"x","seat":2}')).toEqual({
      t: 'join', roomId: 'ABC', displayName: 'Al', secret: 'x', seat: 2,
    });
    expect(parseClientMessage('{"t":"action","action":{"t":"DRAW","playerId":"p","count":1},"clientSeq":3}')).not.toBeNull();
  });

  // Each of these crashed the server — most before any passphrase was checked — and with it
  // every game it was hosting (found by the technical review, against a live server).
  it('refuses the payloads that used to crash the server', () => {
    for (const text of [
      'not json',
      'null',
      '5',
      '{"t":"join","roomId":"ABC","displayName":"Al","secret":1}',
      '{"t":"join","roomId":"ABC","displayName":5,"secret":"x"}',
      '{"t":"join","roomId":"ABC","displayName":"Al","secret":"x","seat":1.5}',
      '{"t":"freeSeat","seat":1.5}',
      '{"t":"deck","list":5}',
      '{"t":"action","action":null,"clientSeq":1}',
      '{"t":"undoVote","targetRevision":"3","approve":true}',
      '{"t":"nonsense"}',
    ]) {
      expect(parseClientMessage(text), text).toBeNull();
    }
  });

  // `undo` names the action the client believes it is undoing, so the server can refuse it once
  // the table has moved on (see server.ts).
  it('accepts undo only with the revision it means to take back', () => {
    expect(parseClientMessage('{"t":"undo","revision":3}')).toEqual({ t: 'undo', revision: 3 });
    expect(parseClientMessage('{"t":"undo"}')).toBeNull();
    expect(parseClientMessage('{"t":"undo","revision":"3"}')).toBeNull();
  });
});
