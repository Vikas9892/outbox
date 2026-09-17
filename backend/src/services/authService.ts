import { prisma } from '../db/prisma';
import { env } from '../config/env';

export class AuthService {
  /**
   * Generates Google OAuth 2.0 Authorization URL.
   */
  static getGoogleAuthUrl(): string {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchanges authorization code for Google user profile and upserts User in database.
   */
  static async handleGoogleCallback(code: string) {
    // 1. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = (await tokenResponse.json()) as any;
    if (!tokens.access_token) {
      throw new Error(tokens.error_description || 'Failed to exchange Google OAuth code');
    }

    // 2. Fetch user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = (await profileResponse.json()) as any;
    if (!profile.email) {
      throw new Error('Google did not return an email address');
    }

    // 3. Upsert user in PostgreSQL
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        googleId: profile.id,
        name: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.picture || null,
      },
      create: {
        googleId: profile.id,
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        avatarUrl: profile.picture || null,
      },
    });

    return user;
  }

  /**
   * Get or create demo user for DEV_AUTH_BYPASS mode.
   */
  static async getDevBypassUser() {
    return prisma.user.upsert({
      where: { email: 'vikast4843@gmail.com' },
      update: {},
      create: {
        name: 'Vikas Tiwari',
        email: 'vikast4843@gmail.com',
        avatarUrl: 'https://avatars.githubusercontent.com/u/9892?v=4',
      },
    });
  }
}

export default AuthService;
