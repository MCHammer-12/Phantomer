import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { XMLParser } from 'fast-xml-parser';
import { PrismaClient } from '@prisma/client';
console.log('HTTP_PROXY=', process.env.HTTP_PROXY, 'HTTPS_PROXY=', process.env.HTTPS_PROXY);

interface XmlZone {
  zone_color?: string;
  price?: string;
}

interface XmlSeat {
  seat_no?: number;
  seat_status?: number;
  seat_type?: number;
  ZoneLabel?: string;
  CustomFill?: string;
}



@Injectable()
export class XMLFetcherService {
  private readonly logger = new Logger(XMLFetcherService.name);
  private readonly prisma = new PrismaClient();

  private readonly SCRAPFLY_KEY = process.env.SCRAPFLY_KEY ?? '';
  private readonly SCRAPFLY_ENABLED = (process.env.SCRAPFLY_ENABLED ?? '0') === '1';
  private readonly SCRAPFLY_ESCALATE = (process.env.SCRAPFLY_ESCALATE ?? '0') === '1'; // allow ASP escalation if cheap tier fails
  private readonly SCRAPFLY_COST_BUDGET_CHEAP = process.env.SCRAPFLY_COST_BUDGET_CHEAP ?? '1'; // 1 credit
  private readonly SCRAPFLY_COST_BUDGET_ASP = process.env.SCRAPFLY_COST_BUDGET_ASP ?? '30';

  // simple in-memory cache and inflight de-duplication per normalized URL
  private memCache = new Map<string, { expires: number; body: string }>();
  private inflight = new Map<string, Promise<string>>();

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      // sort query params for stable keys
      const entries = [...u.searchParams.entries()].sort(([a],[b]) => a.localeCompare(b));
      u.search = entries.length ? '?' + entries.map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
      u.hostname = u.hostname.toLowerCase();
      return u.toString();
    } catch {
      return url.trim();
    }
  }

  private getCached(url: string, ttlMs = 60_000): string | null {
    const key = this.normalizeUrl(url);
    const v = this.memCache.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) { this.memCache.delete(key); return null; }
    return v.body;
  }

  private setCached(url: string, body: string, ttlMs = 60_000): void {
    const key = this.normalizeUrl(url);
    this.memCache.set(key, { expires: Date.now() + ttlMs, body });
  }

  private async fetchOncePerUrl(url: string, fetcher: (u: string) => Promise<string>): Promise<string> {
    const key = this.normalizeUrl(url);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = fetcher(key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async fetchXmlViaScrapfly(url: string, signal: AbortSignal): Promise<string> {
    // If Scrapfly disabled, fall back to direct fetch
    if (!this.SCRAPFLY_ENABLED || !this.SCRAPFLY_KEY) {
      const resp = await fetch(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml,text/xml,*/*' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    }

    // Tier 1: cheapest – datacenter, no browser, no ASP
    const sp1 = new URLSearchParams();
    sp1.set('url', url);
    sp1.set('key', this.SCRAPFLY_KEY);
    sp1.set('proxy_pool', 'public_datacenter_pool');
    sp1.set('retry', 'false');
    sp1.set('country', 'us');
    sp1.set('proxified_response', 'true');
    sp1.set('cache', 'true');
    sp1.set('cache_ttl', '300');
    sp1.set('cost_budget', this.SCRAPFLY_COST_BUDGET_CHEAP); // 1 credit
    let resp = await fetch(`https://api.scrapfly.io/scrape?${sp1.toString()}`, { method: 'GET', signal, headers: { 'Accept': 'application/xml,text/xml,*/*' } });
    if (resp.ok) return await resp.text();

    // If not allowed to escalate, throw
    if (!this.SCRAPFLY_ESCALATE) {
      const cost = resp.headers.get('X-Scrapfly-Api-Cost');
      throw new Error(`Scrapfly cheap-tier failed (cost=${cost || '?'}) HTTP ${resp.status}`);
    }

    // Tier 2: ASP auto (may add browser/residential as needed)
    const sp2 = new URLSearchParams();
    sp2.set('url', url);
    sp2.set('key', this.SCRAPFLY_KEY);
    sp2.set('asp', 'true');
    sp2.set('retry', 'true');
    sp2.set('country', 'us');
    sp2.set('proxified_response', 'true');
    sp2.set('session', 'ticketcheck-arttix');
    sp2.set('session_sticky_proxy', 'true');
    sp2.set('cost_budget', this.SCRAPFLY_COST_BUDGET_ASP);

    resp = await fetch(`https://api.scrapfly.io/scrape?${sp2.toString()}`, { method: 'GET', signal, headers: { 'Accept': 'application/xml,text/xml,*/*' } });
    if (!resp.ok) {
      const cost = resp.headers.get('X-Scrapfly-Api-Cost');
      throw new Error(`Scrapfly ASP-tier failed (cost=${cost || '?'}) HTTP ${resp.status}`);
    }
    return await resp.text();
  }

  private async fetchXml(url: string, signal: AbortSignal): Promise<string> {
    const cached = this.getCached(url);
    if (cached) return cached;
    const body = await this.fetchOncePerUrl(url, (u) => this.fetchXmlViaScrapfly(u, signal));
    // store a short TTL to avoid repeated credits within the same run
    this.setCached(url, body, 60_000);
    return body;
  }

  private async processXmlForEvent(
    xmlText: string,
    eventName: string,
    eventUrl: string,
    eventId: number,
    eventRow?: string,
    eventSection?: string,
    eventGroupSize?: number,
    expectedPrice?: number
  ): Promise<void> {
      /* ───────────────────────── parse XML ───────────────────────── */
      const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
      const parsedData: any = parser.parse(xmlText);
      const root = parsedData.TNSyosSeatDetails || parsedData;

      /* ─────────────── build zone-price lookup ─────────────── */
      const zoneColors: XmlZone[] = root.ZoneColorList?.XmlZone
        ? Array.isArray(root.ZoneColorList.XmlZone)
          ? root.ZoneColorList.XmlZone
          : [root.ZoneColorList.XmlZone]
        : [];

      const zonePriceData = zoneColors.map((z) => ({
        zoneColor: z.zone_color?.toLowerCase().trim() || '',
        price: parseFloat(z.price || '0'),
        eventId,
      }));

      /* ─────────────── extract seats ─────────────── */
      const seats: XmlSeat[] = root.seats?.TNSyosSeat
        ? Array.isArray(root.seats.TNSyosSeat)
          ? root.seats.TNSyosSeat
          : [root.seats.TNSyosSeat]
        : [];

      const seatData = seats.map((seat) => {
        const match = zonePriceData.find(
          (z) => z.zoneColor === seat.CustomFill?.toLowerCase().trim()
        );
        return {
          isvalid: false,
          seatNo: seat.seat_no ? Number(seat.seat_no) : 0,
          seatStatus: seat.seat_status?.toString() || '',
          seatType: seat.seat_type?.toString() || '',
          zoneLabel: seat.ZoneLabel?.toString() || '',
          price: match ? match.price : 0,
          eventId,
          groupChecked: false
        };
      });

      // troubleshooting: logging the amount of parsed seats
      this.logger.debug(`Raw seats parsed: ${seatData.length}`);

      // Set Valid Groups to 0
      let validGroupCount = 0;

      const SeatMapping = await this.prisma.seatMapping.findMany();

      if (eventRow && eventSection) {
        seatData.forEach((seat)=>{
          const mapping = SeatMapping.find((m) => m.seat_no === seat.seatNo);
          if (!['0'].includes(seat.seatStatus)) { this.logger.debug(`Seat ${seat.seatNo} rejected: invalid seatStatus ${seat.seatStatus}`); return; }
          if (seat.seatType !== '1') { this.logger.debug(`Seat ${seat.seatNo} rejected: invalid seatType ${seat.seatType}`); return; }
          if (seat.price !== expectedPrice) { this.logger.debug(`Seat ${seat.seatNo} rejected: price mismatch (found ${seat.price}, expected ${expectedPrice})`); return; }
          if (eventSection && mapping?.section?.toLowerCase().trim() !== eventSection.toLowerCase().trim()) { this.logger.debug(`Seat ${seat.seatNo} rejected: section mismatch (found ${mapping?.section}, expected ${eventSection})`); return; }
          if (!mapping || !mapping.row) { this.logger.debug(`Seat ${seat.seatNo} rejected: no seat mapping or row`); return; }
          if (!this.isRowInFrontOrEqual(mapping.row, eventRow)) { this.logger.debug(`Seat ${seat.seatNo} rejected: row ${mapping.row} is behind target ${eventRow}`); return; }
          seat.isvalid = true;
        });
      }

      const validBeforeGroup = seatData.filter(s => s.isvalid).length;
      this.logger.debug(`Seats valid before group filtering: ${validBeforeGroup}`);

      if (eventGroupSize && eventGroupSize > 1) {
        seatData.forEach((s) => (s.groupChecked = false));
        for (const seat of seatData) {
          if (!seat.isvalid || seat.groupChecked) continue;
          validGroupCount++;
          const group = [seat];
          seat.groupChecked = true;
          const queue = [seat];
          while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;
            const mapping = SeatMapping.find((m) => m.seat_no === current.seatNo);
            if (!mapping || !mapping.adjacent_seats) continue;
            const adjacentSeatNos = mapping.adjacent_seats;
            for (const adjacentNo of adjacentSeatNos) {
              const adjacentSeat = seatData.find((s) => s.seatNo === adjacentNo && s.isvalid && !s.groupChecked);
              if (adjacentSeat) {
                adjacentSeat.groupChecked = true;
                group.push(adjacentSeat);
                queue.push(adjacentSeat);
              }
            }
          }
          if (group.length < eventGroupSize) { group.forEach((s) => (s.isvalid = false)); }
        }
      }

      const validAfterGroup = seatData.filter(s => s.isvalid).length;
      this.logger.debug(`Seats valid after group filtering: ${validAfterGroup}`);

      await this.storeData(eventId, zonePriceData, seatData);

      if (!eventGroupSize || eventGroupSize <= 1) {
        validGroupCount = seatData.filter(s => s.isvalid).length;
      }
      this.logger.debug(`Counted ${validGroupCount} valid groups (no grouping logic)`);

      const summaryMessage = validGroupCount === 0
        ? 'This ticket grouping is no longer available'
        : `This ticket grouping is still available\n# of groups: ${validGroupCount}`;
      this.logger.log(summaryMessage);
      this.logger.log(`Event ID ${eventId}: ${seatData.length} seats stored`);
  }

  private isRowInFrontOrEqual(seatRow: string, targetRow: string): boolean {
    const rowOrder = ['AAA', 'BBB', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
    
    const normalize = (r: string) => r.trim().toUpperCase();
  
    const seatIndex = rowOrder.indexOf(normalize(seatRow));
    const targetIndex = rowOrder.indexOf(normalize(targetRow));
  
    if (seatIndex === -1 || targetIndex === -1) return false; // If row not in list, fail
  
    return seatIndex <= targetIndex;
  }

  private async fetchAndStoreXML(
    eventName: string,
    eventUrl: string,
    eventId: number,
    eventRow?: string,
    eventSection?: string,
    eventGroupSize?: number,
    expectedPrice?: number
  ): Promise<void> {
    /* ───────────────────────── timeout guard ───────────────────────── */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 130_000);

    try {
      this.logger.log(`Fetching XML for ${eventName} (ID: ${eventId})`);
      if (expectedPrice === undefined) {
        this.logger.error(`❌ Missing expectedPrice for event ${eventId} — all seats will fail price validation`);
      }

      const xmlText = await this.fetchXml(eventUrl, controller.signal);
      clearTimeout(timeout);

      await this.processXmlForEvent(
        xmlText,
        eventName,
        eventUrl,
        eventId,
        eventRow,
        eventSection,
        eventGroupSize,
        expectedPrice
      );
    } catch (err: any) {
      clearTimeout(timeout);
      this.logger.error(
        `Fetch failed for ${eventName}: ${err?.cause?.code ?? err.message}`
      );
    }
  }



  private async storeData(
    eventId: number,
    zonePriceData: any[],
    seatData: any[]
  ) {
    await this.prisma.$transaction([
      this.prisma.eventZonePrice.deleteMany({ where: { eventId } }),
      this.prisma.eventSeat.deleteMany({ where: { eventId } }),
    ]);
    if (zonePriceData.length)
      await this.prisma.eventZonePrice.createMany({ data: zonePriceData });
    if (seatData.length)
      await this.prisma.eventSeat.createMany({ data: seatData });
  }

  private isworking = false

  // @Cron('*/12 * * * * *')
  // async handleCron() {
  //   if (this.isworking) return
  //   this.isworking = true
  //   this.logger.log('Executing scheduled XML fetch…');
  //   const events = await this.prisma.event.findMany();
  //   for (const e of events) {
  //     await this.fetchAndStoreXML(
  //       e.name,
  //       e.sourceUrl,
  //       e.id,
  //       e.row || undefined,
  //       e.section || undefined,
  //       e.groupSize || undefined,
  //       e.expectedPrice || undefined
  //     );
  //   }
  //   this.isworking = false
  // }
async runOnce(): Promise<{ successOccurred: boolean; errorsOccurred: boolean }> {
    if (this.isworking) return { successOccurred: false, errorsOccurred: false };
    this.isworking = true;
    this.logger.log('Executing one-time XML fetch…');
    let errorsOccurred = false;

    const events = await this.prisma.event.findMany();
    let successOccurred = false;

    const byUrl = new Map<string, typeof events>();
    for (const e of events) {
      const key = this.normalizeUrl(e.sourceUrl);
      const arr = byUrl.get(key) ?? [];
      arr.push(e);
      byUrl.set(key, arr);
    }

    for (const [url, group] of byUrl) {
      try {
        // Fetch XML once per distinct URL (cached/inflight aware)
        const controller = new AbortController();
        const xmlText = await this.fetchXml(url, controller.signal);
        for (const e of group) {
          await this.processXmlForEvent(
            xmlText,
            e.name,
            e.sourceUrl,
            e.id,
            e.row || undefined,
            e.section || undefined,
            e.groupSize || undefined,
            e.expectedPrice || undefined
          );
          successOccurred = true;
        }
      } catch (err: any) {
        this.logger.error(`Error fetching group url ${url}: ${err?.message ?? err}`);
        errorsOccurred = true;
      }
    }

    if (successOccurred) {
      try {
        const now = new Date().toISOString();
        await this.prisma.metadata.upsert({
          where: { key: 'lastSuccessfulFetch' },
          create: { key: 'lastSuccessfulFetch', value: now },
          update: { value: now },
        });
      } catch (err: any) {
        this.logger.error(`Error persisting metadata: ${err?.message ?? err}`);
      }
    }

    this.isworking = false;
    return { successOccurred, errorsOccurred };
  }
  
  /**
   * Fetch and store reservations for a single event by ID.
   */
  async fetchSingleEvent(eventId: number): Promise<void> {
    try {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        this.logger.error(`Event ${eventId} not found`);
        return;
      }
      await this.fetchAndStoreXML(
        event.name,
        event.sourceUrl,
        event.id,
        event.row || undefined,
        event.section || undefined,
        event.groupSize || undefined,
        event.expectedPrice || undefined
      );
    } catch (err: any) {
      this.logger.error(`Error in fetchSingleEvent(${eventId}): ${err.message}`);
    }
  }
}
