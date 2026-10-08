import {
  Controller,
  Post,
  Put,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LocalAuthService } from './local-auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth.guard';

// El registro público fue eliminado: los usuarios los crea un ADMIN vía POST /users.
// Para el primer ADMIN de una instalación nueva usar: node dist/scripts/create-admin.js
@Controller('auth')
export class LocalAuthController {
  constructor(private readonly localAuthService: LocalAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.localAuthService.login(dto);
  }

  // Perfil del usuario conectado (datos que se usan en los informes)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    return this.localAuthService.getProfile(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.localAuthService.updateProfile(req.user.id, dto);
  }
}
