import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { STRONG_PASSWORD_PATTERN } from '../constants/password.constants';

export class RegisterDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_PATTERN, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password!: string;

  @ApiProperty({ example: '2250700000000' })
  @IsString()
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  phone!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  lastName!: string;

  @ApiProperty({ example: 'Cocody' })
  @IsString()
  @IsNotEmpty({ message: 'La commune est obligatoire' })
  commune!: string;

  @ApiProperty({ example: 'Abidjan' })
  @IsString()
  @IsNotEmpty({ message: 'La ville est obligatoire' })
  city!: string;

  @ApiProperty({
    description: 'Consentement communications marketing email et WhatsApp (RGPD)',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'Le consentement marketing est obligatoire' })
  marketingConsent!: boolean;
}
