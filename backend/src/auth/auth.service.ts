import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface AdminJwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPasswordHash = this.config.get<string>('ADMIN_PASSWORD_HASH');

    if (!adminEmail || !adminPasswordHash) {
      throw new UnauthorizedException('Admin no configurado');
    }

    const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
    const passwordMatches = emailMatches && (await bcrypt.compare(password, adminPasswordHash));

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: AdminJwtPayload = { sub: adminEmail, email: adminEmail };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }
}
