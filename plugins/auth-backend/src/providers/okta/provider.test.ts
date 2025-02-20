/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { OktaAuthProvider } from './provider';
import * as helpers from '../../lib/passport/PassportStrategyHelper';
import { OAuthResult } from '../../lib/oauth';
import { AuthResolverContext, OAuthStartResponse } from '../types';

jest.mock('../../lib/passport/PassportStrategyHelper', () => {
  return {
    executeFrameHandlerStrategy: jest.fn(),
    executeRefreshTokenStrategy: jest.fn(),
    executeFetchUserProfileStrategy: jest.fn(),
    executeRedirectStrategy: jest.fn(),
  };
});

const mockFrameHandler = jest.spyOn(
  helpers,
  'executeFrameHandlerStrategy',
) as unknown as jest.MockedFunction<
  () => Promise<{ result: OAuthResult; privateInfo: any }>
>;

const mockRedirectStrategy = jest.spyOn(
  helpers,
  'executeRedirectStrategy',
) as unknown as jest.MockedFunction<() => Promise<OAuthStartResponse>>;

describe('createOktaProvider', () => {
  it('should auth', async () => {
    const provider = new OktaAuthProvider({
      resolverContext: {} as AuthResolverContext,
      authHandler: async ({ fullProfile }) => ({
        profile: {
          email: fullProfile.emails![0]!.value,
          displayName: fullProfile.displayName,
        },
      }),
      audience: 'http://example.com',
      clientId: 'mock',
      clientSecret: 'mock',
      callbackUrl: 'mock',
    });

    mockFrameHandler.mockResolvedValueOnce({
      result: {
        fullProfile: {
          emails: [
            {
              type: 'work',
              value: 'conrad@example.com',
            },
          ],
          displayName: 'Conrad',
          name: {
            familyName: 'Ribas',
            givenName: 'Francisco',
          },
          id: 'conrad',
          provider: 'okta',
          photos: [
            {
              value: 'some-data',
            },
          ],
        },
        params: {
          id_token: 'idToken',
          scope: 'scope',
          expires_in: 123,
        },
        accessToken: 'accessToken',
      },
      privateInfo: {
        refreshToken: 'wacka',
      },
    });
    const { response } = await provider.handler({} as any);
    expect(response).toEqual({
      providerInfo: {
        accessToken: 'accessToken',
        expiresInSeconds: 123,
        idToken: 'idToken',
        scope: 'scope',
      },
      profile: {
        email: 'conrad@example.com',
        displayName: 'Conrad',
      },
    });
  });

  it('should pass a custom scope to start and refresh requests', async () => {
    const additionalScopes = 'groups';
    const reqScope = 'openid profile email offline_access';
    const combinedScope = `${reqScope} ${additionalScopes}`;
    const provider = new OktaAuthProvider({
      resolverContext: {} as AuthResolverContext,
      authHandler: async ({ fullProfile }) => ({
        profile: {
          email: fullProfile.emails![0]!.value,
          displayName: fullProfile.displayName,
        },
      }),
      audience: 'http://example.com',
      clientId: 'mock',
      clientSecret: 'mock',
      callbackUrl: 'mock',
      additionalScopes,
    });

    mockRedirectStrategy.mockResolvedValueOnce({
      url: 'http://example.com/',
    });

    const req: any = {
      state: {
        nonce: 'nonce',
        env: 'development',
      },
      scope: reqScope,
    };

    await provider.start(req);
    const mockCallScope = (mockRedirectStrategy.mock.calls[0] as any)?.[2]
      ?.scope;
    expect(mockCallScope).toBe(combinedScope);
  });
});
