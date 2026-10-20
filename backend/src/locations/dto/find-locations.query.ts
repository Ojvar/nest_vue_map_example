import { Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { BILLBOARD_TYPES, BillboardType } from '../location.interface';

const MAX_ZOOM = 22;

export class FindLocationsQuery {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  minLat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  minLng?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  maxLat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  maxLng?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  zoom?: number;

  /** Comma-separated list, e.g. `types=unipole,digital`. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value))
  @IsArray()
  @ArrayUnique({ message: 'types must not contain duplicates' })
  @IsIn(BILLBOARD_TYPES, { each: true, message: `types must be any of: ${BILLBOARD_TYPES.join(', ')}` })
  types?: BillboardType[];
}
