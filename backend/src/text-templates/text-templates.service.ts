import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTextTemplateDto, UpdateTextTemplateDto } from './dto/text-template.dto';

@Injectable()
export class TextTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.textTemplate.findMany({ orderBy: [{ orden: 'asc' }, { title: 'asc' }] });
  }

  async create(dto: CreateTextTemplateDto) {
    const orden = dto.orden ?? (await this.prisma.textTemplate.count()) + 1;
    return this.prisma.textTemplate.create({ data: { title: dto.title, body: dto.body, orden } });
  }

  async update(id: string, dto: UpdateTextTemplateDto) {
    await this.findOrThrow(id);
    return this.prisma.textTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.textTemplate.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const template = await this.prisma.textTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Texto no encontrado');
    return template;
  }
}
