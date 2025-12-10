import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaClient } from '@prisma/client';

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
  private readonly SCRAPFLY_ESCALATE = (process.env.SCRAPFLY_ESCALATE ?? '0') === '1';
  private readonly SCRAPFLY_COST_BUDGET_CHEAP = process.env.SCRAPFLY_COST_BUDGET_CHEAP ?? '1';
  private readonly SCRAPFLY_COST_BUDGET_ASP = process.env.SCRAPFLY_COST_BUDGET_ASP ?? '30';

  private memCache = new Map<string, { expires: number; body: string }>();
  private inflight = new Map<string, Promise<string>>();

  private buildUrl(performanceId: string, screenId: number, facilityId = 487): string {
    // Basic input validation
    if (performanceId == null) {
      throw new Error("performanceId must not be null or undefined");
    }
    const pid = performanceId.trim();
    if (!/^[A-Za-z0-9]{5}$/.test(pid)) {
      throw new Error(`performanceId must be exactly 5 alphanumeric characters (got "${performanceId}")`);
    }

    if (screenId == null || Number.isNaN(Number(screenId))) {
      throw new Error("screenId must be a number in [1..5]");
    }
    const sid = Number(screenId);
    if (sid < 1 || sid > 5) {
      throw new Error(`screenId must be between 1 and 5 (got ${screenId})`);
    }

    const fid = facilityId ?? 487;

    return `https://my.arttix.org/api/syos/GetSeatList?performanceId=${encodeURIComponent(pid)}&facilityId=${fid}&screenId=${sid}`;
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      const entries = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
      u.search = entries.length
        ? '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        : '';
      u.hostname = u.hostname.toLowerCase();
      return u.toString();
    } catch {
      return url.trim();
    }
  }

  private getCached(url: string): string | null {
    const key = this.normalizeUrl(url);
    const v = this.memCache.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) {
      this.memCache.delete(key);
      return null;
    }
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
    this.logger.log(`[Fetcher] Starting fetchXmlViaScrapfly for URL=${url}`);
    this.logger.log(`[Fetcher] Scrapfly enabled=${this.SCRAPFLY_ENABLED} keyPresent=${!!this.SCRAPFLY_KEY}`);
    if (!this.SCRAPFLY_ENABLED || !this.SCRAPFLY_KEY) {
      this.logger.log(`[Fetcher] Using Node direct fetch → ${url}`);
      const resp = await fetch(url, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/xml,text/xml,*/*' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.logger.log(`[Fetcher] Node direct fetch completed status=${resp.status}`);
      return await resp.text();
    }

    const sp1 = new URLSearchParams();
    sp1.set('url', url);
    sp1.set('key', this.SCRAPFLY_KEY);
    sp1.set('proxy_pool', 'public_residential_pool');
    sp1.set('retry', 'true');
    sp1.set('country', 'us');
    sp1.set('proxified_response', 'true');
    sp1.set('cache', 'true');
    sp1.set('cache_ttl', '300');
    sp1.set('cost_budget', this.SCRAPFLY_COST_BUDGET_CHEAP);

    this.logger.log(`[Fetcher] Scrapfly CHEAP-tier request starting…`);

    const cheapUrl = `https://api.scrapfly.io/scrape?${sp1.toString()}`;
    this.logger.log(`[Fetcher] Scrapfly CHEAP-tier URL=${cheapUrl}`);

    const cheapStart = Date.now();
    let resp = await fetch(cheapUrl, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/xml,text/xml,*/*' },
    });
this.logger.log(
  `[Fetcher] Scrapfly CHEAP-tier response status=${resp.status} elapsed=${Date.now() - cheapStart}ms`
);
    this.logger.log(`[Fetcher] Scrapfly CHEAP-tier response status=${resp.status}`);

    if (resp.ok) return await resp.text();

    if (!this.SCRAPFLY_ESCALATE) {
      const cost = resp.headers.get('X-Scrapfly-Api-Cost');
      throw new Error(`Scrapfly cheap-tier failed (cost=${cost || '?'}) HTTP ${resp.status}`);
    }

    const sp2 = new URLSearchParams();
    sp2.set('url', url);
    sp2.set('key', this.SCRAPFLY_KEY);
    sp2.set('asp', 'true');
    sp2.set('retry', 'true');
    sp2.set('proxy_pool', 'public_residential_pool');
    sp2.set('country', 'us');
    sp2.set('proxified_response', 'true');
    sp2.set('session', 'ticketcheck-arttix');
    sp2.set('session_sticky_proxy', 'true');
    sp2.set('cost_budget', this.SCRAPFLY_COST_BUDGET_ASP);

    this.logger.log(`[Fetcher] Scrapfly ASP-tier request starting…`);
    resp = await fetch(`https://api.scrapfly.io/scrape?${sp2.toString()}`, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/xml,text/xml,*/*' },
    });
    this.logger.log(`[Fetcher] Scrapfly ASP-tier response status=${resp.status}`);
    if (!resp.ok) {
      const cost = resp.headers.get('X-Scrapfly-Api-Cost');
      throw new Error(`Scrapfly ASP-tier failed (cost=${cost || '?'}) HTTP ${resp.status}`);
    }
    return await resp.text();
  }

  private async fetchXml(url: string, signal: AbortSignal): Promise<string> {
    this.logger.log(`[Fetcher] fetchXml request for URL=${url}`);

    const cached = this.getCached(url);
    if (cached) {
      this.logger.log(`[Fetcher] Cache HIT for URL=${url}`);
      return cached;
    }

    this.logger.log(`[Fetcher] Cache MISS for URL=${url}`);

    const body = await this.fetchOncePerUrl(url, (u) => this.fetchXmlViaScrapfly(u, signal));
    this.setCached(url, body, 60_000);

    return body;
}

  private async processXmlForEvent(
    xmlText: string,
    eventId: number,
    eventName: string,
    screenId: number,
    eventRow?: string,
    eventSection?: string,
    eventGroupSize?: number,
    expectedPrice?: number
  ): Promise<number> {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsedData: any = parser.parse(xmlText);
    const root = parsedData.TNSyosSeatDetails || parsedData;

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

    const seats: XmlSeat[] = root.seats?.TNSyosSeat
      ? Array.isArray(root.seats.TNSyosSeat)
        ? root.seats.TNSyosSeat
        : [root.seats.TNSyosSeat]
      : [];

    const seatData = seats.map((seat) => {
      const match = zonePriceData.find((z) => z.zoneColor === seat.CustomFill?.toLowerCase().trim());
      return {
        isvalid: false,
        seatNo: seat.seat_no ? Number(seat.seat_no) : 0,
        seatStatus: seat.seat_status?.toString() || '',
        seatType: seat.seat_type?.toString() || '',
        zoneLabel: seat.ZoneLabel?.toString() || '',
        price: match ? match.price : 0,
        eventId,
        groupChecked: false,
      };
    });

    this.logger.debug(`Raw seats parsed: ${seatData.length}`);

    let validGroupCount = 0;
    const SeatMapping = await this.prisma.seatMapping.findMany({ where: { screen_id: screenId } });

    // Build quick metadata lookup for seat_no → { row, section }
    const seatMeta = new Map<number, { row?: string; section?: string }>();
    for (const m of SeatMapping as any[]) {
      if (m && typeof m.seat_no === 'number') {
        seatMeta.set(m.seat_no, { row: (m as any).row, section: (m as any).section });
      }
    }

    if (eventRow && eventSection) {
      seatData.forEach((seat) => {
        const mapping = SeatMapping.find((m) => m.seat_no === seat.seatNo);
        if (!['0'].includes(seat.seatStatus)) {
          this.logger.debug(`Seat ${seat.seatNo} rejected: invalid seatStatus ${seat.seatStatus}`);
          return;
        }
        if (seat.seatType !== '1') {
          this.logger.debug(`Seat ${seat.seatNo} rejected: invalid seatType ${seat.seatType}`);
          return;
        }
        if (typeof expectedPrice === 'number' && seat.price > expectedPrice) {
          this.logger.debug(`Seat ${seat.seatNo} rejected: price ${seat.price} exceeds expected max ${expectedPrice}`);
          return;
        }

        if (eventSection) {
          const req = eventSection.toLowerCase().trim();
          const got = (mapping?.section || '').toLowerCase().trim();

          const matchesSection = (() => {
            if (!got) return false;
            if (req === 'center') return got === 'center';
            if (req === 'left' || req === 'right') return got === 'left' || got === 'right';
            if (req === 'box') return got === 'box';
            return got === req; // fallback: strict match
          })();

          if (!matchesSection) {
            this.logger.debug(`Seat ${seat.seatNo} rejected: section mismatch (found ${mapping?.section}, expected ${eventSection} with L/R interchangeable)`);
            return;
          }
        }
        if (!mapping || !mapping.row) {
          this.logger.debug(`Seat ${seat.seatNo} rejected: no seat mapping or row`);
          return;
        }
        if (!this.isRowInFrontOrEqual(mapping.row, eventRow)) {
          this.logger.debug(`Seat ${seat.seatNo} rejected: row ${mapping.row} is behind target ${eventRow}`);
          return;
        }
        seat.isvalid = true;
      });
    }

    const validBeforeGroup = seatData.filter((s) => s.isvalid).length;
    this.logger.debug(`Seats valid before group filtering: ${validBeforeGroup}`);
    if (eventGroupSize && eventGroupSize > 1) {
      // Reset groupChecked flags
      seatData.forEach((s) => (s.groupChecked = false));

      // Build a set of valid seat numbers for O(1) membership tests
      const validSet = new Set<number>(seatData.filter((s) => s.isvalid).map((s) => s.seatNo));

      // Helper to check if two seats share the same row & section (based on DB mapping)
      const sameRowSection = (a: number, b: number): boolean => {
        const ma = seatMeta.get(a);
        const mb = seatMeta.get(b);
        if (!ma || !mb) return false;
        const ra = (ma.row || '').trim().toUpperCase();
        const rb = (mb.row || '').trim().toUpperCase();
        const sa = (ma.section || '').trim().toLowerCase();
        const sb = (mb.section || '').trim().toLowerCase();
        return ra === rb && sa === sb;
      };

      // Strict adjacency: only seat_no-1 and seat_no+1 within the same row & section
      const getNeighbors = (n: number): number[] => {
        const out: number[] = [];
        const left = n - 1;
        const right = n + 1;
        if (validSet.has(left) && sameRowSection(n, left)) out.push(left);
        if (validSet.has(right) && sameRowSection(n, right)) out.push(right);
        return out;
      };

      validGroupCount = 0;
      for (const seat of seatData) {
        if (!seat.isvalid || seat.groupChecked) continue;
        // BFS to collect the contiguous block by strict neighbors
        const group: typeof seatData = [] as any;
        const queue: number[] = [];
        seat.groupChecked = true;
        queue.push(seat.seatNo);

        while (queue.length > 0) {
          const currentNo = queue.shift()!;
          const current = seatData.find((s) => s.seatNo === currentNo);
          if (!current) continue;
          group.push(current);
          for (const nb of getNeighbors(currentNo)) {
            const nbSeat = seatData.find((s) => s.seatNo === nb);
            if (nbSeat && nbSeat.isvalid && !nbSeat.groupChecked) {
              nbSeat.groupChecked = true;
              queue.push(nb);
            }
          }
        }

        if (group.length >= eventGroupSize) {
          validGroupCount++;
        } else {
          // Not enough contiguous seats; mark them invalid so they don't count later
          group.forEach((s) => (s.isvalid = false));
        }
      }
    }

    const validAfterGroup = seatData.filter((s) => s.isvalid).length;
    this.logger.debug(`Seats valid after group filtering: ${validAfterGroup}`);

    await this.storeData(eventId, zonePriceData, seatData);

    if (!eventGroupSize || eventGroupSize <= 1) {
      validGroupCount = seatData.filter((s) => s.isvalid).length;
    }
    this.logger.debug(`Counted ${validGroupCount} valid groups`);

    try {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { groupCount: validGroupCount },
      });
    } catch (e: any) {
      this.logger.error(`Failed to persist groupCount for event ${eventId}: ${e?.message ?? e}`);
    }
    return validGroupCount;
  }

  private isRowInFrontOrEqual(seatRow: string, targetRow: string): boolean {
    const rowOrder = ['AAA', 'BBB', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'SS', 'TT', 'UU', 'VV', 'WW', 'YY', 'ZZ'];
    const normalize = (r: string) => r.trim().toUpperCase();
    const seatIndex = rowOrder.indexOf(normalize(seatRow));
    const targetIndex = rowOrder.indexOf(normalize(targetRow));
    if (seatIndex === -1 || targetIndex === -1) return false;
    return seatIndex <= targetIndex;
  }

  /**
   * Try to fetch & process once for a given performanceId value.
   * Returns the processed group count on success.
   */
  private async tryFetchProcess(
    name: string,
    eventId: number,
    performanceId: string,
    screenId: number,
    facilityId: number,
    row?: string,
    section?: string,
    groupSize?: number,
    expectedPrice?: number
  ): Promise<number> {
    const url = this.buildUrl(performanceId, screenId, facilityId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 130_000);
    try {
      const xmlText = await this.fetchXml(url, controller.signal);
      clearTimeout(timeout);
      return await this.processXmlForEvent(
        xmlText,
        eventId,
        name,
        screenId,
        row,
        section,
        groupSize,
        expectedPrice
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchAndStoreForEvent(eventId: number): Promise<number> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      this.logger.error(`Event ${eventId} not found`);
      return 0;
    }

    if (!event.performanceId || event.screenId == null) {
      this.logger.error(`Event ${eventId} missing performanceId or screenId`);
      return 0;
    }

    const facilityId = event.facilityId ?? 487;
    const basePidRaw = String(event.performanceId).trim();
    const isNumeric = /^\d+$/.test(basePidRaw);

    this.logger.log(`Fetching XML for ${event.name} (ID: ${event.id}) with PID ${basePidRaw} (screenId=${event.screenId}, facilityId=${facilityId})`);
    if (event.expectedPrice === undefined || event.expectedPrice === null) {
      this.logger.warn(`⚠️ Missing expectedPrice for event ${event.id} — price validation may drop all seats`);
    }

    // Attempt base performanceId, then increment up to +10 if HTTP errors occur
    const maxIncrement = 10;
    const basePidNum = isNumeric ? Number(basePidRaw) : NaN;

    for (let delta = 0; delta <= (isNumeric ? maxIncrement : 0); delta++) {
      const candidatePid = isNumeric ? String(basePidNum + delta) : basePidRaw;
      try {
        if (delta > 0) {
          this.logger.warn(`Base PID failed; retrying with PID=${candidatePid} (attempt ${delta + 1}/${maxIncrement + 1}) for event ${event.id}`);
        }
        const groups = await this.tryFetchProcess(
          event.name,
          event.id,
          candidatePid,
          Number(event.screenId),
          facilityId,
          event.row || undefined,
          event.section || undefined,
          event.groupSize || undefined,
          event.expectedPrice || undefined
        );
        this.logger.log(`Fetch OK for event ${event.id} using PID=${candidatePid} → groups=${groups}`);
        return groups;
      } catch (err: any) {
        // Only continue loop on HTTP/network errors; other exceptions will also retry until maxIncrement
        const msg = err?.message ?? String(err);
        this.logger.error(`Fetch attempt with PID=${candidatePid} failed for event ${event.id}: ${msg}`);
        // proceed to next delta if available
        if (delta === (isNumeric ? maxIncrement : 0)) {
          // No more retries
          break;
        }
      }
    }

    // All attempts failed
    return 0;
  }

  private async storeData(eventId: number, zonePriceData: any[], seatData: any[]) {
    await this.prisma.$transaction([
      this.prisma.eventZonePrice.deleteMany({ where: { eventId } }),
      this.prisma.eventSeat.deleteMany({ where: { eventId } }),
    ]);
    if (zonePriceData.length) await this.prisma.eventZonePrice.createMany({ data: zonePriceData });
    if (seatData.length) await this.prisma.eventSeat.createMany({ data: seatData });
  }

  private isworking = false;

  async runOnce(): Promise<{ successOccurred: boolean; errorsOccurred: boolean }> {
    if (this.isworking) return { successOccurred: false, errorsOccurred: false };
    this.isworking = true;
    this.logger.log('Executing one-time XML fetch…');

    let errorsOccurred = false;
    let successOccurred = false;

    const events = await this.prisma.event.findMany();

    for (const e of events) {
      try {
        const gc = await this.fetchAndStoreForEvent(e.id);
        this.logger.log(`# of groups (persisted) for event ${e.id}: ${gc}`);
        successOccurred = true;
      } catch (err: any) {
        this.logger.error(`Error fetching event ${e.id}: ${err?.message ?? err}`);
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

  async fetchSingleEvent(eventId: number): Promise<number> {
    try {
      const gc = await this.fetchAndStoreForEvent(eventId);
      this.logger.log(`# of groups (persisted): ${gc}`);
      return gc;
    } catch (err: any) {
      this.logger.error(`Error in fetchSingleEvent(${eventId}): ${err.message}`);
      return 0;
    }
  }
}