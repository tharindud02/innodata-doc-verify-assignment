import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'tharindud02@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'tharindu1234' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'tharindud02@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'tharindu1234' })
  @IsString()
  @MinLength(1)
  password!: string;
}