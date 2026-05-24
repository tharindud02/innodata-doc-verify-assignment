import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { getJwtExpiresIn } from './jwt.constants';
import { JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
      },
      select: { id: true, email: true },
    });

    this.logger.log(`User signed up: ${user.email}`);
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Constant-message error for both cases — don't leak whether the email exists
    const invalid = () => new UnauthorizedException('Invalid email or password');

    if (!user) throw invalid();
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw invalid();

    return this.issueToken({ id: user.id, email: user.email });
  }

  private issueToken(user: { id: string; email: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const token = this.jwt.sign(payload, {
      expiresIn: getJwtExpiresIn(this.config),
    });
    return {
      token,
      user: { id: user.id, email: user.email },
    };
  }
}
