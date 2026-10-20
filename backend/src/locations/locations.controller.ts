import { Controller, Get, Query } from '@nestjs/common';
import { FindLocationsQuery } from './dto/find-locations.query';
import { LocationsResponseDto } from './dto/locations-response.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  find(@Query() query: FindLocationsQuery): LocationsResponseDto {
    const items = this.locationsService.find(query);
    return { total: items.length, items };
  }
}
