import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateProfileSettingsDto } from './auth/dto/update-profile-settings.dto';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ProfileSettingsService {
  private static readonly avatarStorageDir = join(process.cwd(), 'storage', 'avatars');
  private static readonly avatarPublicPrefix = '/uploads/avatars/';
  private static readonly maxAvatarBytes = 1024 * 1024;
  private static readonly avatarMimeExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toResponse(user);
  }

  async patchSettings(userId: string, dto: UpdateProfileSettingsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userUpdate: Prisma.UserUpdateInput = {};
    const settingsUpdate: Prisma.UserSettingsUpdateInput = {};
    const settingsCreate: Prisma.UserSettingsCreateInput = {
      user: { connect: { id: userId } },
    };
    let avatarCleanupUrl: string | null = null;
    let createdAvatarFilePath: string | null = null;

    if (dto.edit) {
      if (dto.edit.avatarUrl !== undefined) {
        const avatarUpdate = await this.normalizeAvatarUrl(
          userId,
          dto.edit.avatarUrl,
          user.settings?.avatarUrl ?? null,
        );
        const value = avatarUpdate.avatarUrl;
        settingsUpdate.avatarUrl = value;
        settingsCreate.avatarUrl = value;
        avatarCleanupUrl = avatarUpdate.previousLocalAvatarUrl;
        createdAvatarFilePath = avatarUpdate.createdFilePath;
      }

      if (dto.edit.fullName !== undefined) {
        userUpdate.fullName = dto.edit.fullName.trim();
      }

      if (dto.edit.email !== undefined) {
        const normalizedEmail = dto.edit.email.trim().toLowerCase();
        if (normalizedEmail !== user.email) {
          const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
          });
          if (existing && existing.id !== userId) {
            throw new ConflictException('Email is already registered');
          }
          userUpdate.email = normalizedEmail;
        }
      }

      if (dto.edit.userName !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.userName);
        settingsUpdate.userName = value;
        settingsCreate.userName = value;
      }

      if (dto.edit.dateOfBirth !== undefined) {
        const value = this.normalizeDate(dto.edit.dateOfBirth);
        settingsUpdate.dateOfBirth = value;
        settingsCreate.dateOfBirth = value;
      }

      if (dto.edit.presentAddress !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.presentAddress);
        settingsUpdate.presentAddress = value;
        settingsCreate.presentAddress = value;
      }

      if (dto.edit.permanentAddress !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.permanentAddress);
        settingsUpdate.permanentAddress = value;
        settingsCreate.permanentAddress = value;
      }

      if (dto.edit.city !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.city);
        settingsUpdate.city = value;
        settingsCreate.city = value;
      }

      if (dto.edit.postalCode !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.postalCode);
        settingsUpdate.postalCode = value;
        settingsCreate.postalCode = value;
      }

      if (dto.edit.country !== undefined) {
        const value = this.normalizeOptionalString(dto.edit.country);
        settingsUpdate.country = value;
        settingsCreate.country = value;
      }
    }

    if (dto.preferences) {
      if (dto.preferences.interfaceLanguage !== undefined) {
        const value = this.normalizeOptionalString(dto.preferences.interfaceLanguage);
        settingsUpdate.interfaceLanguage = value;
        settingsCreate.interfaceLanguage = value;
      }

      if (dto.preferences.timeZone !== undefined) {
        const value = this.normalizeOptionalString(dto.preferences.timeZone);
        settingsUpdate.timeZone = value;
        settingsCreate.timeZone = value;
      }

      if (dto.preferences.notifyAnnouncements !== undefined) {
        settingsUpdate.notifyAnnouncements = dto.preferences.notifyAnnouncements;
        settingsCreate.notifyAnnouncements = dto.preferences.notifyAnnouncements;
      }

      if (dto.preferences.notifyReviews !== undefined) {
        settingsUpdate.notifyReviews = dto.preferences.notifyReviews;
        settingsCreate.notifyReviews = dto.preferences.notifyReviews;
      }

      if (dto.preferences.notifyMessages !== undefined) {
        settingsUpdate.notifyMessages = dto.preferences.notifyMessages;
        settingsCreate.notifyMessages = dto.preferences.notifyMessages;
      }
    }

    if (dto.security) {
      if (dto.security.currentPassword && !dto.security.newPassword) {
        throw new BadRequestException('newPassword is required');
      }

      if (dto.security.newPassword) {
        if (!dto.security.currentPassword) {
          throw new BadRequestException('currentPassword is required');
        }

        const currentPasswordValid = await bcrypt.compare(
          dto.security.currentPassword,
          user.passwordHash,
        );
        if (!currentPasswordValid) {
          throw new BadRequestException('Current password is invalid');
        }

        userUpdate.passwordHash = await bcrypt.hash(dto.security.newPassword, 10);
      }
    }

    const shouldUpdateUser = Object.keys(userUpdate).length > 0;
    const shouldUpsertSettings = Object.keys(settingsUpdate).length > 0;

    if (shouldUpdateUser || shouldUpsertSettings) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (shouldUpdateUser) {
            await tx.user.update({
              where: { id: userId },
              data: userUpdate,
            });
          }

          if (shouldUpsertSettings) {
            await tx.userSettings.upsert({
              where: { userId },
              update: settingsUpdate,
              create: settingsCreate,
            });
          }
        });
      } catch (error) {
        if (createdAvatarFilePath) {
          await rm(createdAvatarFilePath, { force: true }).catch(() => undefined);
        }
        throw error;
      }

      if (avatarCleanupUrl) {
        await this.removeLocalAvatarFile(avatarCleanupUrl);
      }
    }

    return this.getSettings(userId);
  }

  private normalizeOptionalString(value: string) {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    return normalized;
  }

  private async normalizeAvatarUrl(
    userId: string,
    value: string,
    currentAvatarUrl: string | null,
  ) {
    const normalized = value.trim();
    const currentLocalAvatarUrl = this.isLocalAvatarUrl(currentAvatarUrl)
      ? currentAvatarUrl
      : null;
    if (normalized.length === 0) {
      return {
        avatarUrl: null,
        previousLocalAvatarUrl: currentLocalAvatarUrl,
        createdFilePath: null,
      };
    }

    const isHttpUrl = /^https?:\/\/\S+$/i.test(normalized);
    if (isHttpUrl || this.isLocalAvatarUrl(normalized)) {
      return {
        avatarUrl: normalized,
        previousLocalAvatarUrl:
          currentLocalAvatarUrl && currentLocalAvatarUrl !== normalized
            ? currentLocalAvatarUrl
            : null,
        createdFilePath: null,
      };
    }

    const imageDataMatch = normalized.match(
      /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i,
    );
    if (!imageDataMatch) {
      throw new BadRequestException(
        'avatarUrl must be an image data URL, local upload URL, or http(s) URL',
      );
    }

    const mimeType = imageDataMatch[1].toLowerCase();
    const extension = ProfileSettingsService.avatarMimeExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('avatarUrl image type is not supported');
    }

    const imageBuffer = Buffer.from(imageDataMatch[2], 'base64');
    if (imageBuffer.length === 0) {
      throw new BadRequestException('avatarUrl image payload is empty');
    }

    if (imageBuffer.length > ProfileSettingsService.maxAvatarBytes) {
      throw new BadRequestException('avatarUrl image is too large');
    }

    await mkdir(ProfileSettingsService.avatarStorageDir, { recursive: true });
    const fileName = `${userId}-${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = join(ProfileSettingsService.avatarStorageDir, fileName);
    await writeFile(filePath, imageBuffer);

    return {
      avatarUrl: `${ProfileSettingsService.avatarPublicPrefix}${fileName}`,
      previousLocalAvatarUrl: currentLocalAvatarUrl,
      createdFilePath: filePath,
    };
  }

  private isLocalAvatarUrl(value: string | null | undefined) {
    return (
      typeof value === 'string' &&
      value.startsWith(ProfileSettingsService.avatarPublicPrefix) &&
      value.length > ProfileSettingsService.avatarPublicPrefix.length
    );
  }

  private async removeLocalAvatarFile(url: string) {
    if (!this.isLocalAvatarUrl(url)) {
      return;
    }

    const fileName = url.slice(ProfileSettingsService.avatarPublicPrefix.length);
    if (fileName.includes('/') || fileName.includes('\\')) {
      return;
    }

    const filePath = join(ProfileSettingsService.avatarStorageDir, fileName);
    await rm(filePath, { force: true }).catch(() => undefined);
  }

  private normalizeDate(value: string) {
    if (value.trim().length === 0) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('dateOfBirth is invalid');
    }

    return parsed;
  }

  private toResponse(user: {
    id: string;
    fullName: string;
    email: string;
    settings: {
      avatarUrl: string | null;
      userName: string | null;
      dateOfBirth: Date | null;
      presentAddress: string | null;
      permanentAddress: string | null;
      city: string | null;
      postalCode: string | null;
      country: string | null;
      interfaceLanguage: string | null;
      timeZone: string | null;
      notifyAnnouncements: boolean;
      notifyReviews: boolean;
      notifyMessages: boolean;
    } | null;
  }) {
    return {
      edit: {
        avatarUrl: user.settings?.avatarUrl ?? '',
        fullName: user.fullName,
        userName: user.settings?.userName ?? user.fullName,
        email: user.email,
        dateOfBirth: user.settings?.dateOfBirth
          ? user.settings.dateOfBirth.toISOString().slice(0, 10)
          : '',
        presentAddress: user.settings?.presentAddress ?? '',
        permanentAddress: user.settings?.permanentAddress ?? '',
        city: user.settings?.city ?? '',
        postalCode: user.settings?.postalCode ?? '',
        country: user.settings?.country ?? '',
      },
      preferences: {
        interfaceLanguage: user.settings?.interfaceLanguage ?? 'English',
        timeZone: user.settings?.timeZone ?? '(GMT+02:00) Eastern Europe',
        notifyAnnouncements: user.settings?.notifyAnnouncements ?? true,
        notifyReviews: user.settings?.notifyReviews ?? false,
        notifyMessages: user.settings?.notifyMessages ?? true,
      },
    };
  }
}
