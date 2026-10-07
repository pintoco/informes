import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LocalAuthService } from './local-auth.service';
import { LoginDto } from './dto/login.dto';
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    return req.user;
  }
}
