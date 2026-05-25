import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Returns JWT token and basic user profile',
    schema: {
      example: {
        token: '<jwt-token>',
        user: { id: 'clx...', email: 'tharindud02@gmail.com' },
      },
    },
  })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Authenticate and return JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Returns JWT token and basic user profile',
    schema: {
      example: {
        token: '<jwt-token>',
        user: { id: 'clx...', email: 'tharindud02@gmail.com' },
      },
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}