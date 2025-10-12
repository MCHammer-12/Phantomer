import { Body, Controller, Post, Get, Delete, Param, Patch, BadRequestException, NotFoundException, HttpException, Query } from '@nestjs/common';
import { XMLFetcherService } from '../services/xml-fetcher.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateEventDto {
  name: string;
  eventUrl: string;   // full URL from user
  screenId: number;   // 1..5
  row: string;
  section: string;    // left|center|right
  groupSize: number;
  expectedPrice: number;
  userTag?: string | null; // optional user identifier
}

function extractPerformanceIdFromUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) throw new BadRequestException("eventUrl is required");

  // Try URL parsing first; fall back to string parsing if invalid URL
  let pathname = "";
  try {
    const u = new URL(raw);
    pathname = u.pathname || "";
  } catch {
    // Fallback: try to extract a path-like portion from the raw string
    // This keeps behavior robust for inputs like "my.arttix.org/12345/67890?foo"
    const m = raw.match(/^[^?#]*/);
    pathname = m ? m[0] : raw;
  }

  // Split path into non-empty segments and scan from the end
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].trim();
    if (/^\d{5}$/.test(seg)) {
      return seg; // last 5-digit segment
    }
  }

  // If nothing matched as an exact 5-digit segment, the input doesn't meet the rule
  throw new BadRequestException(
    "Could not extract a 5-digit performanceId from eventUrl path (expecting the last path segment to be 5 digits)."
  );
}

function normalizeEventUrlForStorage(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  // Strip http/https scheme if present
  const withoutScheme = s.replace(/^https?:\/\//i, "");
  // Remove a single trailing slash
  return withoutScheme.replace(/\/$/, "");
}

@Controller('events')
export class EventController {
  constructor(private readonly xmlFetcherService: XMLFetcherService) {}

  @Post('add')
  async createEvent(@Body() body: CreateEventDto) {
    try {
      if (!body.eventUrl || typeof body.eventUrl !== "string") {
        throw new BadRequestException("eventUrl is required");
      }
      const performanceId = extractPerformanceIdFromUrl(body.eventUrl);
      if (![1, 2, 3, 4, 5].includes(Number(body.screenId))) {
        throw new BadRequestException("screenId must be 1..5");
      }
      if (!['left', 'center', 'right'].includes(String(body.section).toLowerCase())) {
        throw new BadRequestException('section must be left|center|right');
      }

      const normalizedUrl = normalizeEventUrlForStorage(body.eventUrl);
      const event = await prisma.event.create({
        data: {
          name: body.name,
          eventUrl: normalizedUrl,          // store backlink sans scheme
          performanceId,                    // derived
          screenId: Number(body.screenId),
          row: body.row,
          section: body.section.toLowerCase(),
          groupSize: body.groupSize,
          expectedPrice: body.expectedPrice,
          userTag: body.userTag ?? null,
          // facilityId defaults to 487 (schema)
        },
      });

      return { message: 'Event created successfully', event };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      console.error('Error creating event:', err);
      return { error: 'Failed to create event' };
    }
  }

  @Get('all')
  async getEvents(@Query('userTag') userTag?: string) {
    try {
      const events = await prisma.event.findMany({
        where: userTag ? { userTag } : undefined,
      });
      const eventsWithGroupings = await Promise.all(
        events.map(async (e) => {
          const size = e.groupSize ?? 1;
          const validSeatsCount = await prisma.eventSeat.count({
            where: { eventId: e.id, isvalid: true },
          });
          const isAvailable = size > 1 ? validSeatsCount >= size : validSeatsCount > 0;
          const grouping = {
            id: e.id,
            section: e.section,
            row: e.row,
            price: e.expectedPrice,
            groupSize: size,
            isAvailable,
            groupsFound: e.groupCount ?? 0,
          };
          return {
            id: e.id,
            eventName: e.name,
            eventUrl: e.eventUrl,
            dateCreated: e.createdAt,
            groupCount: e.groupCount,
            groupings: [grouping],
            performanceId: e.performanceId,
            screenId: e.screenId,
            facilityId: e.facilityId,
            userTag: e.userTag,
          };
        })
      );
      return eventsWithGroupings;
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
      eventUrl: e.eventUrl,
      dateCreated: e.createdAt,
      groupCount: e.groupCount,
      performanceId: e.performanceId,
      screenId: e.screenId,
      facilityId: e.facilityId,
      groupings: [
        {
          id: e.id,
          section: e.section,
          row: e.row,
          price: e.expectedPrice,
          groupSize: size,
          isAvailable,
          groupsFound: e.groupCount ?? 0,
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
    const groupCount = await this.xmlFetcherService.fetchSingleEvent(eventId);
    return { message: 'Event refresh complete', eventId, groupCount };
  }

  @Delete(':id')
  async deleteEvent(@Param('id') id: string) {
    const eventId = parseInt(id, 10);
    try {
      await prisma.eventSeat.deleteMany({ where: { eventId } });
      await prisma.eventZonePrice.deleteMany({ where: { eventId } });
      await prisma.event.delete({ where: { id: eventId } });
      return { message: 'Event deleted' };
    } catch (error) {
      console.error('Error deleting event:', error);
      return { error: 'Failed to delete event' };
    }
  }

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
    if (typeof body.section === 'string') data.section = body.section.toLowerCase();
    if (typeof body.row === 'string') data.row = body.row;
    if (typeof body.groupSize === 'number') data.groupSize = body.groupSize;
    if (typeof body.price === 'number') data.expectedPrice = body.price;

    const updated = await prisma.event.update({ where: { id: eventId }, data });

    const size = updated.groupSize ?? 1;
    const validSeatsCount = await prisma.eventSeat.count({
      where: { eventId: updated.id, isvalid: true },
    });
    const isAvailable = size > 1 ? validSeatsCount >= size : validSeatsCount > 0;

    return {
      id: updated.id,
      eventName: updated.name,
      eventUrl: updated.eventUrl,
      dateCreated: updated.createdAt,
      performanceId: updated.performanceId,
      screenId: updated.screenId,
      facilityId: updated.facilityId,
      groupings: [
        {
          id: updated.id,
          section: updated.section,
          row: updated.row,
          price: updated.expectedPrice,
          groupSize: size,
          isAvailable,
          groupsFound: updated.groupCount ?? 0,
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