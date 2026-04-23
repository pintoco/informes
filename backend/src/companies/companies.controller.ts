import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, CreateLocationDto } from './dto/company.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ── Companies ──────────────────────────────────────────

  @Get()
  findAll() {
    return this.companiesService.findAllCompanies();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.createCompany(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: CreateCompanyDto) {
    return this.companiesService.updateCompany(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.companiesService.removeCompany(id);
  }

  // ── Locations ─────────────────────────────────────────

  @Get(':id/locations')
  getLocations(@Param('id') id: string) {
    return this.companiesService.findLocationsByCompany(id);
  }

  @Post(':id/locations')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  addLocation(@Param('id') id: string, @Body() dto: CreateLocationDto) {
    return this.companiesService.createLocation(id, dto);
  }

  @Delete(':id/locations/:locationId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLocation(@Param('id') id: string, @Param('locationId') locationId: string) {
    return this.companiesService.removeLocation(id, locationId);
  }
}
