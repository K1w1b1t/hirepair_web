import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { GuestAccessService } from './guest-access.service';
import { GuestAnalysisService } from './guest-analysis.service';
import type { GuestAnalysisResponse } from './guest.types';

class GuestAccessDto {
  @IsString() @MaxLength(100) visitorId!: string;
  @IsBoolean() acceptedTerms!: boolean;
  @IsBoolean() acceptedPrivacy!: boolean;
}
class GuestDocumentDto {
  @IsString() @MaxLength(100) id!: string;
  @IsString() @MaxLength(80_000) text!: string;
}
class GuestAnalysisDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestDocumentDto)
  documents!: GuestDocumentDto[];
  @IsOptional() @IsString() @MaxLength(20_000) jobText?: string;
  @IsOptional() @IsString() @MaxLength(200) targetRole?: string;
}

@Controller('guest')
export class GuestController {
  constructor(
    private readonly access: GuestAccessService,
    private readonly analysis: GuestAnalysisService,
  ) {}
  @Post('access') accessToken(@Body() body: GuestAccessDto) {
    if (!body.acceptedTerms || !body.acceptedPrivacy)
      throw new UnauthorizedException('Aceite os termos para iniciar.');
    return this.access.issue(body.visitorId);
  }
  @Post('job-analysis') analyze(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: GuestAnalysisDto,
    @Req() request: Request,
  ): Promise<GuestAnalysisResponse> {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException();
    if (body.documents.reduce((size, document) => size + document.text.length, 0) > 80_000)
      throw new BadRequestException('Selecione materiais menores para esta análise.');
    return this.analysis.analyze(token, body, request.ip);
  }
}
