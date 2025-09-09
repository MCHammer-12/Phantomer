import { Body, Controller, Post, Get, Delete, Param, Patch, BadRequestException, NotFoundException } from '@nestjs/common';
import { XMLFetcherService } from '../services/xml-fetcher.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); 

interface CreateEventDto {
  name: string;
  url: string;
  row: string;       // New
  section: string;   // New, e.g., "left", "center", "right"
  groupSize: number; // New
  expectedPrice: number;
}

@Controller('events') 
export class EventController {
  constructor(private readonly xmlFetcherService: XMLFetcherService) {}
  
  @Post('add') 
  async createEvent(@Body() body: CreateEventDto) {
    try {
      const event = await prisma.event.create({
        data: { 
          name: body.name, 
          sourceUrl: body.url,
          row: body.row,
          section: body.section,
          groupSize: body.groupSize,
          expectedPrice: body.expectedPrice
        },
      });
      return { message: 'Event created successfully', event };
    } catch (error) {
      console.error('Error creating event:', error);
      return { error: 'Failed to create event' };
    }
  }

  @Get('all')
  async getEvents() {
    try {
      const events = await prisma.event.findMany();
      const eventsWithGroupings = await Promise.all(
        events.map(async (e) => {
          const size = e.groupSize ?? 1;
          const validSeatsCount = await prisma.eventSeat.count({
            where: { eventId: e.id, isvalid: true },
          });
          const isAvailable =
            size > 1 ? validSeatsCount >= size : validSeatsCount > 0;
          const grouping = {
            id: e.id,
            section: e.section,
            row: e.row,
            price: e.expectedPrice,
            groupSize: size,
            isAvailable,
          };
          return {
            id: e.id,
            eventName: e.name,
            eventUrl: e.sourceUrl,
            dateCreated: e.createdAt,
            groupings: [grouping],
          };
        })
      );
      return { events: eventsWithGroupings };
    } catch (error) {
      console.error('Error fetching events:', error);
      return { error: 'Failed to fetch events' };
    }
  }

  @Get('by-id/:id')
async getEvent(@Param('id') id: string) {
  const eventId = parseInt(id, 10);
  const e = await prisma.event.findUnique({ where: { id: eventId } });
  if (!e) {
    throw new NotFoundException('Event not found');
  }

  const size = e.groupSize ?? 1;
  const validSeatsCount = await prisma.eventSeat.count({
    where: { eventId: e.id, isvalid: true },
  });
  const isAvailable = size > 1 ? validSeatsCount >= size : validSeatsCount > 0;

  return {
    id: e.id,
    eventName: e.name,
    eventUrl: e.sourceUrl,
    dateCreated: e.createdAt,
    groupings: [
      {
        id: e.id,
        section: e.section,
        row: e.row,
        price: e.expectedPrice,
        groupSize: size,
        isAvailable,
      },
    ],
  };
}
  
  @Post('refresh')
  async refreshAll() {
    const result = await this.xmlFetcherService.runOnce();
    return { message: 'Refresh complete', errorsOccurred: result.errorsOccurred };
}

  @Post(':id/refresh')
  async refreshEvent(@Param('id') id: string) {
    const eventId = parseInt(id, 10);
    await this.xmlFetcherService.fetchSingleEvent(eventId);
    return { message: 'Event refresh triggered', eventId };
  }

  @Delete(':id')
  async deleteEvent(@Param('id') id: string) {
    const eventId = parseInt(id, 10);
    try {
      // Delete dependent records first
      await prisma.eventSeat.deleteMany({ where: { eventId } });
      await prisma.eventZonePrice.deleteMany({ where: { eventId } });
      // Then delete the event
      await prisma.event.delete({ where: { id: eventId } });
      return { message: 'Event deleted' };
    } catch (error) {
      console.error('Error deleting event:', error);
      return { error: 'Failed to delete event' };
    }
  }

  // Update a grouping (maps to updating the event's fields since grouping id === event id)
@Patch('groupings/:id')
async updateGrouping(
  @Param('id') id: string,
  @Body() body: { section?: string; row?: string; price?: number; groupSize?: number }
) {
  const eventId = parseInt(id, 10);
  if (Number.isNaN(eventId)) {
    throw new BadRequestException('Invalid id');
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw new NotFoundException('Event not found');
  }

  const data: any = {};
  if (typeof body.section === 'string') data.section = body.section;
  if (typeof body.row === 'string') data.row = body.row;
  if (typeof body.groupSize === 'number') data.groupSize = body.groupSize;
  if (typeof body.price === 'number') data.expectedPrice = body.price; // price maps to expectedPrice

  const updated = await prisma.event.update({ where: { id: eventId }, data });

  // Return a normalized shape similar to list entries
  const size = updated.groupSize ?? 1;
  const validSeatsCount = await prisma.eventSeat.count({
    where: { eventId: updated.id, isvalid: true },
  });
  const isAvailable = size > 1 ? validSeatsCount >= size : validSeatsCount > 0;

  return {
    id: updated.id,
    eventName: updated.name,
    eventUrl: updated.sourceUrl,
    dateCreated: updated.createdAt,
    groupings: [
      {
        id: updated.id,
        section: updated.section,
        row: updated.row,
        price: updated.expectedPrice,
        groupSize: size,
        isAvailable,
      },
    ],
  };
}

  @Delete('groupings/:id')
  async deleteGrouping(@Param('id') id: string) {
    return { message: 'Grouping deleted' };
  }

  @Get('last-updated')
  async getLastUpdated() {
    const record = await prisma.metadata.findUnique({
      where: { key: 'lastSuccessfulFetch' },
    });
    return { lastUpdated: record?.value ?? null };
  }
}