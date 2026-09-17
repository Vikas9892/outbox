import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { SlackService } from '../services/slackService';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

export const googleLogin = (_req: Request, res: Response): void => {
  if (env.DEV_AUTH_BYPASS) {
    // Development bypass mode
    AuthService.getDevBypassUser().then((user) => {
      (_req.session as any).userId = user.id;
      res.redirect(env.CLIENT_URL);
    });
    return;
  }

  const url = AuthService.getGoogleAuthUrl();
  res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  if (!code) {
    res.redirect(`${env.CLIENT_URL}/login?error=missing_code`);
    return;
  }

  try {
    const user = await AuthService.handleGoogleCallback(code);
    (req.session as any).userId = user.id;
    res.redirect(env.CLIENT_URL);
  } catch (err: any) {
    console.error('[AuthController] Google login failed:', err.message);
    res.redirect(`${env.CLIENT_URL}/login?error=auth_failed`);
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    let userId = (req.session as any)?.userId;

    // In dev mode with dev auth bypass enabled or fallback to default user if no session
    if (!userId && env.DEV_AUTH_BYPASS) {
      const devUser = await AuthService.getDevBypassUser();
      userId = devUser.id;
      (req.session as any).userId = devUser.id;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        user: null,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        user: null,
      });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const logout = (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, error: 'Could not log out' });
      return;
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

export const slackAuthorize = (_req: Request, res: Response): void => {
  const url = SlackService.getAuthorizeUrl();
  res.redirect(url);
};

export const slackCallback = async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const userId = (req.session as any)?.userId;

  if (!code) {
    res.redirect(`${env.CLIENT_URL}/?slack=missing_code`);
    return;
  }

  // Get effective user
  const effectiveUserId = userId || (await AuthService.getDevBypassUser()).id;
  const success = await SlackService.handleCallback(code, effectiveUserId);

  if (success) {
    res.redirect(`${env.CLIENT_URL}/?slack=connected`);
  } else {
    res.redirect(`${env.CLIENT_URL}/?slack=error`);
  }
};

export const getSlackStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId || (await AuthService.getDevBypassUser()).id;
    const status = await SlackService.isConnected(userId);
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const disconnectSlack = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId || (await AuthService.getDevBypassUser()).id;
    await SlackService.disconnect(userId);
    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
