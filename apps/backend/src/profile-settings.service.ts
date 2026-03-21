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

    if (dto.edit) {
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

