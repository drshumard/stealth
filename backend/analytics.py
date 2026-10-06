"""Stealth analytics — read-only aggregations over page_visits, contacts, stealth_registrations and sales.

Every endpoint takes the same filters (date range in a timezone, UTM source / medium / campaign / ad / ad set,
page, host) and caches its result briefly; identical concurrent requests share one computation.

Definitions used throughout:
  visitor     a distinct contact_id with a page visit (merges move visits onto the surviving contact)
  new         first seen (contact created) in the period; returning = visited in the period, first seen before it
  identified  has an email or phone
  registered  tagged 'stealth' (StealthWebinar webhook) or 'registered' (tracking script on the thank-you page)
  abandoned   identified but not registered
  buyer       has a sale (refunded / failed / cancelled sales excluded)
"""
import asyncio
import contextvars
import hashlib
import logging
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

logger = logging.getLogger('analytics')

REG_TAGS = ['stealth', 'registered']
BAD_SALE = ['refunded', 'failed', 'cancelled']
ATTR = {'source': 'utm_source', 'medium': 'utm_medium', 'campaign': 'utm_campaign', 'content': 'utm_content', 'term': 'utm_term'}
KNOWN = {'$nin': [None, '']}
WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']   # Mongo $dayOfWeek: 1 = Sunday


# ── cache ────────────────────────────────────────────────────────────────────
# Two layers: this process's memory, then MongoDB (analytics_cache) — shared by both uvicorn workers and kept across
# restarts. A fresh result is returned at once; a stale one (under STALE) is returned at once while it refreshes in
# the background; only a never-seen view is computed while the request waits — at most WAIT seconds, after which it
# answers 202 {"pending": true} (nginx cuts /api requests at 60s) and the work carries on.
# A warmer (below) re-runs the views people actually opened, so they are ready before anyone asks.
WAIT = 25
STALE = 24 * 3600
WARM_AGE = 120            # a warm-up request recomputes anything older than this
_cache: dict = {}
_tasks: dict = {}
_store = {'coll': None}   # set by build_router
_force = contextvars.ContextVar('analytics_force', default=False)


class Pending(Exception):
    pass


async def pending_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse({'pending': True, 'detail': 'Still computing — try again in a few seconds.'}, status_code=202)


def _id(key):
    return hashlib.sha1(key.encode()).hexdigest()


async def _l2_get(key):
    coll = _store['coll']
    if coll is None:
        return None
    try:
        doc = await coll.find_one({'_id': _id(key)}, {'at': 1, 'value': 1})
        return (doc['at'], doc['value']) if doc else None
    except Exception:
        return None


async def _l2_put(key, at, value):
    coll = _store['coll']
    if coll is None:
        return
    try:
        await coll.replace_one({'_id': _id(key)}, {'key': key[:500], 'at': at, 'value': value,
                                                   'expires': datetime.now(timezone.utc) + timedelta(seconds=STALE * 2)}, upsert=True)
    except Exception as e:   # too large / not storable: memory cache only
        logger.warning('analytics cache not stored (%s): %s', key[:60], str(e)[:120])


async def _run(key, compute, persist):
    try:
        value = await compute()
        at = time.time()
        _cache[key] = (at, value)
        if len(_cache) > 400:   # drop the oldest half
            for k, _ in sorted(_cache.items(), key=lambda kv: kv[1][0])[:200]:
                _cache.pop(k, None)
        if persist:
            await _l2_put(key, at, value)
        return value
    finally:
        _tasks.pop(key, None)


def forget(*keys):
    """Drop memory-cached results (this worker), e.g. after a deletion."""
    for k in keys:
        _cache.pop(k, None)


async def cached(key: str, ttl: int, compute, wait=WAIT, persist=None):
    persist = wait is not None if persist is None else persist   # nested helper caches stay in memory
    now = time.time()
    fresh_for = min(ttl, WARM_AGE) if _force.get() else ttl
    hit = _cache.get(key)
    if persist and (not hit or now - hit[0] >= fresh_for):
        l2 = await _l2_get(key)
        if l2 and (not hit or l2[0] > hit[0]):
            hit = l2
            _cache[key] = l2
    if hit and now - hit[0] < fresh_for:
        return hit[1]
    task = _tasks.get(key)
    if task is None:
        task = asyncio.create_task(_run(key, compute, persist))
        task.add_done_callback(lambda t: t.cancelled() or t.exception())   # never "exception was never retrieved"
        _tasks[key] = task
    if hit and now - hit[0] < STALE and not _force.get():
        return hit[1]
    if wait is None:
        return await asyncio.shield(task)
    try:
        return await asyncio.wait_for(asyncio.shield(task), wait)
    except asyncio.TimeoutError:
        raise Pending()


# ── filters ──────────────────────────────────────────────────────────────────
class Filters:
    def __init__(self, since, until, tz, source, medium, campaign, content, term, page, host):
        try:
            self.zone = ZoneInfo(tz or 'UTC')
        except Exception:
            raise HTTPException(status_code=400, detail='Unknown timezone')
        self.tz = tz or 'UTC'
        today = datetime.now(self.zone).date()
        try:
            self.until = date.fromisoformat(until) if until else today
            self.since = date.fromisoformat(since) if since else self.until - timedelta(days=29)
        except ValueError:
            raise HTTPException(status_code=400, detail='Dates must be YYYY-MM-DD')
        if self.since > self.until:
            raise HTTPException(status_code=400, detail='since is after until')
        self.days = (self.until - self.since).days + 1
        split = lambda v: [x.strip() for x in v.split(',') if x.strip()] if v else []
        self.attr = {k: split(v) for k, v in
                     dict(source=source, medium=medium, campaign=campaign, content=content, term=term).items()}
        self.pages = [p.lower().rstrip('/') for p in split(page)]
        self.hosts = [h.lower() for h in split(host)]

    def key(self, *extra):
        return '|'.join(map(str, [self.since, self.until, self.tz, sorted(self.attr.items()), self.pages, self.hosts, *extra]))

    def bounds(self, since=None, until=None):
        """UTC ISO bounds [start, end) for local dates since..until (inclusive)."""
        s, u = since or self.since, until or self.until
        start = datetime(s.year, s.month, s.day, tzinfo=self.zone)
        end = datetime(u.year, u.month, u.day, tzinfo=self.zone) + timedelta(days=1)
        return iso(start), iso(end)

    def previous(self):
        """The same filters over the equally long period just before this one."""
        p = Filters.__new__(Filters)
        p.__dict__.update(self.__dict__)
        p.until = self.since - timedelta(days=1)
        p.since = p.until - timedelta(days=self.days - 1)
        return p

    @property
    def has_attr(self):
        return any(self.attr.values())

    def attr_match(self, prefix=''):
        m = {}
        for k, field in ATTR.items():
            vals = self.attr[k]
            if vals:
                vs = [None if v == '(none)' else v for v in vals]
                m[f'{prefix}attribution.{field}'] = {'$in': vs + ([''] if None in vs else [])}
        return m

    def url_match(self):
        pats = [r'^https?://(www\.)?' + re.escape(p) + r'/?([?#]|$)' for p in self.pages]
        pats += [r'^https?://(www\.)?' + re.escape(h) + r'([/?#:]|$)' for h in self.hosts]
        return {'current_url': {'$regex': '|'.join(pats), '$options': 'i'}} if pats else {}

    def visit_match(self, since=None, until=None):
        s, e = self.bounds(since, until)
        return {'timestamp': {'$gte': s, '$lt': e}, **self.attr_match(), **self.url_match()}


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# ── expressions ──────────────────────────────────────────────────────────────
def to_date(field):
    return {'$dateFromString': {'dateString': f'${field}', 'onError': None, 'onNull': None}}


_url = {'$toLower': {'$ifNull': ['$current_url', '']}}
_noq = {'$arrayElemAt': [{'$split': [{'$arrayElemAt': [{'$split': [_url, '?']}, 0]}, '#']}, 0]}
_hp = {'$arrayElemAt': [{'$split': [_noq, '://']}, -1]}
_hp = {'$cond': [{'$eq': [{'$substrCP': [_hp, 0, 4]}, 'www.']}, {'$substrCP': [_hp, 4, 100000]}, _hp]}
PAGE = {'$let': {'vars': {'p': {'$rtrim': {'input': _hp, 'chars': '/'}}},
                 'in': {'$cond': [{'$eq': ['$$p', '']}, '(unknown)', '$$p']}}}
HOST = {'$arrayElemAt': [{'$split': [PAGE, '/']}, 0]}
_ref = {'$toLower': {'$ifNull': ['$referrer_url', '']}}
_rh = {'$arrayElemAt': [{'$split': [{'$arrayElemAt': [{'$split': [_ref, '://']}, -1]}, '/']}, 0]}
REFERRER = {'$cond': [{'$eq': [_ref, '']}, '(direct)',
                      {'$cond': [{'$eq': [{'$substrCP': [_rh, 0, 4]}, 'www.']}, {'$substrCP': [_rh, 4, 100000]}, _rh]}]}


def attr_expr(field, prefix=''):
    v = {'$ifNull': [f'${prefix}attribution.{field}', '']}
    return {'$cond': [{'$eq': [v, '']}, '(none)', v]}


def _rx(path, pat):
    return {'$regexMatch': {'input': {'$ifNull': [path, '']}, 'regex': pat, 'options': 'i'}}


def device_expr(p='$user_agent'):
    return {'$switch': {'branches': [
        {'case': {'$eq': [{'$ifNull': [p, '']}, '']}, 'then': 'Unknown'},
        {'case': _rx(p, 'ipad|tablet'), 'then': 'Tablet'},
        {'case': {'$and': [_rx(p, 'android'), {'$not': [_rx(p, 'mobile')]}]}, 'then': 'Tablet'},
        {'case': _rx(p, 'mobi|iphone|ipod|android'), 'then': 'Mobile'},
    ], 'default': 'Desktop'}}


def os_expr(p='$user_agent'):
    return {'$switch': {'branches': [
        {'case': {'$eq': [{'$ifNull': [p, '']}, '']}, 'then': 'Unknown'},
        {'case': _rx(p, 'iphone|ipad|ipod'), 'then': 'iOS'},
        {'case': _rx(p, 'android'), 'then': 'Android'},
        {'case': _rx(p, 'windows'), 'then': 'Windows'},
        {'case': _rx(p, 'cros'), 'then': 'ChromeOS'},
        {'case': _rx(p, 'macintosh|mac os x'), 'then': 'macOS'},
        {'case': _rx(p, 'linux'), 'then': 'Linux'},
    ], 'default': 'Other'}}


def browser_expr(p='$user_agent'):
    return {'$switch': {'branches': [
        {'case': {'$eq': [{'$ifNull': [p, '']}, '']}, 'then': 'Unknown'},
        {'case': _rx(p, 'fban|fbav|fb_iab|fbios'), 'then': 'Facebook app'},
        {'case': _rx(p, 'instagram'), 'then': 'Instagram app'},
        {'case': _rx(p, 'edg/|edga|edgios'), 'then': 'Edge'},
        {'case': _rx(p, 'samsungbrowser'), 'then': 'Samsung Internet'},
        {'case': _rx(p, 'crios|chrome'), 'then': 'Chrome'},
        {'case': _rx(p, 'fxios|firefox'), 'then': 'Firefox'},
        {'case': _rx(p, 'safari'), 'then': 'Safari'},
    ], 'default': 'Other'}}


IDENTIFIED = {'$or': [{'$gt': [{'$strLenCP': {'$ifNull': ['$email', '']}}, 0]},
                      {'$gt': [{'$strLenCP': {'$ifNull': ['$phone', '']}}, 0]}]}
TAGGED = {'$gt': [{'$size': {'$setIntersection': [{'$ifNull': ['$tags', []]}, REG_TAGS]}}, 0]}
# Registered = identified AND tagged. (The thank-you-page script can tag a contact that holds no email/phone itself;
# counting those would put registrations above identifications.) So registered + abandoned = identified.
REGISTERED = {'$and': [IDENTIFIED, TAGGED]}
STATUS = {'$switch': {'branches': [{'case': REGISTERED, 'then': 'Registered'}, {'case': IDENTIFIED, 'then': 'Abandoned'}],
                      'default': 'Anonymous'}}

VISIT_DIMS = {'page', 'host', 'title', 'referrer', 'source', 'medium', 'campaign', 'content', 'term', 'weekday', 'hour'}
CONTACT_DIMS = {'source', 'medium', 'campaign', 'content', 'term', 'device', 'os', 'browser', 'status', 'weekday', 'hour'}
DIM_LABELS = {'page': 'Page', 'host': 'Site', 'title': 'Page title', 'referrer': 'Referrer', 'source': 'Source',
              'medium': 'Medium', 'campaign': 'Campaign', 'content': 'Ad (utm_content)', 'term': 'Ad set (utm_term)',
              'weekday': 'Weekday', 'hour': 'Hour of day', 'device': 'Device', 'os': 'Operating system',
              'browser': 'Browser / app', 'status': 'Lead status'}


def visit_dim(dim, tz):
    ts = to_date('timestamp')
    return {'page': PAGE, 'host': HOST, 'referrer': REFERRER,
            'title': {'$cond': [{'$in': [{'$ifNull': ['$page_title', '']}, ['']]}, '(untitled)', '$page_title']},
            'weekday': {'$dayOfWeek': {'date': ts, 'timezone': tz}}, 'hour': {'$hour': {'date': ts, 'timezone': tz}},
            **{k: attr_expr(v) for k, v in ATTR.items()}}[dim]


def contact_dim(dim, tz):
    ts = to_date('created_at')
    return {'device': device_expr(), 'os': os_expr(), 'browser': browser_expr(), 'status': STATUS,
            'weekday': {'$dayOfWeek': {'date': ts, 'timezone': tz}}, 'hour': {'$hour': {'date': ts, 'timezone': tz}},
            **{k: attr_expr(v) for k, v in ATTR.items()}}[dim]


def label_value(dim, v):
    if dim == 'weekday' and isinstance(v, int):
        return WEEKDAYS[v - 1]
    if dim == 'hour' and isinstance(v, int):
        return f'{v:02d}:00'
    return v if v not in (None, '') else '(none)'


GRAN = {'hour': ('hour', '%Y-%m-%dT%H:00'), 'day': ('day', '%Y-%m-%d'), 'week': ('week', '%Y-%m-%d'), 'month': ('month', '%Y-%m-%d')}


def auto_gran(days):
    return 'hour' if days <= 2 else 'day' if days <= 92 else 'week' if days <= 400 else 'month'


def bucket_expr(field, gran, tz):
    unit, fmt = GRAN[gran]
    trunc = {'date': to_date(field), 'unit': unit, 'timezone': tz}
    if unit == 'week':
        trunc['startOfWeek'] = 'monday'
    return {'$dateToString': {'date': {'$dateTrunc': trunc}, 'format': fmt, 'timezone': tz}}


def bucket_keys(f: Filters, gran):
    """Every bucket key from since..until, matching bucket_expr's output."""
    keys = []
    if gran == 'hour':
        cur = datetime(f.since.year, f.since.month, f.since.day, tzinfo=f.zone)
        end = datetime(f.until.year, f.until.month, f.until.day, tzinfo=f.zone) + timedelta(days=1)
        while cur < end:
            keys.append(cur.strftime('%Y-%m-%dT%H:00'))
            cur = (cur.astimezone(timezone.utc) + timedelta(hours=1)).astimezone(f.zone)
        return list(dict.fromkeys(keys))
    d = f.since
    if gran == 'week':
        d = d - timedelta(days=d.weekday())
    if gran == 'month':
        d = d.replace(day=1)
    while d <= f.until:
        keys.append(d.isoformat())
        if gran == 'day':
            d += timedelta(days=1)
        elif gran == 'week':
            d += timedelta(days=7)
        else:
            d = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
    return keys


def rate(n, d):
    return round(n / d, 4) if d else None


def hist(values, edges, labels):
    """Count values into [edges[i], edges[i+1]) buckets."""
    out = [0] * len(labels)
    for v in values:
        for i in range(len(edges) - 1):
            if edges[i] <= v < edges[i + 1]:
                out[i] += 1
                break
    return [{'bucket': l, 'count': c} for l, c in zip(labels, out)]


# ── router ───────────────────────────────────────────────────────────────────
WARM_EVERY = 300          # seconds between warm-up rounds
WARM_MAX = 40             # views per round
WARM_WINDOW = 48 * 3600   # warm views opened in the last 48 hours
_app = {'app': None}
_worker = uuid.uuid4().hex[:8]


def build_router(db) -> APIRouter:
    _store['coll'] = db.analytics_cache

    async def track(request: Request):
        """Remember which views people open (for the warmer); mark warm-up requests."""
        _app['app'] = request.app
        if request.headers.get('x-analytics-warm') == '1':
            _force.set(True)
            return
        path = request.url.path
        if request.method == 'GET' and not path.endswith(('/live', '/views', '/dimensions')):
            url = path + ('?' + request.url.query if request.url.query else '')
            try:
                await db.analytics_hits.update_one({'_id': _id(url)}, {'$set': {'url': url, 'last': datetime.now(timezone.utc)},
                                                                       '$inc': {'hits': 1}}, upsert=True)
            except Exception:
                pass

    r = APIRouter(prefix='/analytics', dependencies=[Depends(track)])

    async def warm_round():
        import httpx
        app = _app['app']
        if app is None:
            return 0
        since = datetime.now(timezone.utc) - timedelta(seconds=WARM_WINDOW)
        urls = [d['url'] for d in await db.analytics_hits.find({'last': {'$gte': since}}, {'url': 1})
                .sort([('hits', -1), ('last', -1)]).limit(WARM_MAX).to_list(WARM_MAX)]
        done = 0
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://warm', timeout=60) as c:
            for url in urls:
                for _ in range(40):             # a heavy view answers 202 until it is ready
                    res = await c.get(url, headers={'x-analytics-warm': '1'})
                    if res.status_code != 202:
                        break
                    await asyncio.sleep(3)
                done += 1
                await db.analytics_meta.update_one({'_id': 'warmer', 'owner': _worker},
                                                   {'$set': {'until': datetime.now(timezone.utc) + timedelta(seconds=WARM_EVERY)}})
        return done

    async def warmer():
        await asyncio.sleep(30)
        while True:
            try:
                now_ = datetime.now(timezone.utc)
                # one worker at a time: a lease in MongoDB
                lease = await db.analytics_meta.find_one_and_update(
                    {'_id': 'warmer', '$or': [{'until': {'$lt': now_}}, {'owner': _worker}]},
                    {'$set': {'owner': _worker, 'until': now_ + timedelta(seconds=WARM_EVERY)}}, upsert=False)
                if lease is None and not await db.analytics_meta.find_one({'_id': 'warmer'}):
                    try:
                        await db.analytics_meta.insert_one({'_id': 'warmer', 'owner': _worker, 'until': now_ + timedelta(seconds=WARM_EVERY)})
                        lease = True
                    except Exception:
                        lease = None
                if lease:
                    t0 = time.time()
                    n = await warm_round()
                    if n:
                        logger.info('analytics warmer: %d views refreshed in %.0fs', n, time.time() - t0)
            except Exception as e:
                logger.warning('analytics warmer round failed: %s', str(e)[:200])
            await asyncio.sleep(WARM_EVERY)

    @r.on_event('startup')
    async def start_warmer():
        try:
            await db.analytics_cache.create_index('expires', expireAfterSeconds=0)
            await db.analytics_hits.create_index('last', expireAfterSeconds=7 * 24 * 3600)
        except Exception as e:
            logger.warning('analytics cache indexes: %s', str(e)[:200])
        asyncio.create_task(warmer())

    async def agg(coll, pipeline, hint=None):
        opts = {'hint': hint} if hint else {}
        return await db[coll].aggregate(pipeline, allowDiskUse=True, maxTimeMS=240000, **opts).to_list(None)

    def ch(match):
        """With a page filter the contact match carries an id list: make Mongo use the contact_id index."""
        return 'contact_id_1' if 'contact_id' in match else None

    async def count(match):
        h = ch(match)
        return await db.contacts.count_documents(match, **({'hint': h} if h else {}))

    def common(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
               source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
               content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
               host: Optional[str] = None):
        return Filters(since, until, tz, source, medium, campaign, content, term, page, host)

    # Status sets — small (tens of thousands of ids), shared by every endpoint.
    async def status_sets():
        async def compute():
            idf, reg, sales = await asyncio.gather(
                db.contacts.distinct('contact_id', {'merged_into': None, '$or': [{'email': KNOWN}, {'phone': KNOWN}]}),
                db.contacts.distinct('contact_id', {'merged_into': None, 'tags': {'$in': REG_TAGS}, '$or': [{'email': KNOWN}, {'phone': KNOWN}]}),
                db.sales.find({'status': {'$nin': BAD_SALE}, 'contact_id': KNOWN},
                              {'_id': 0, 'contact_id': 1, 'amount': 1, 'created_at': 1}).to_list(None))
            # Sales may point at a contact that was later merged: follow merged_into.
            ids = list({s['contact_id'] for s in sales})
            merged = {d['contact_id']: d['merged_into'] for d in await db.contacts.find(
                {'contact_id': {'$in': ids}, 'merged_into': KNOWN}, {'_id': 0, 'contact_id': 1, 'merged_into': 1}).to_list(None)}
            revenue = {}
            for s in sales:
                cid = merged.get(s['contact_id'], s['contact_id'])
                s['contact_id'] = cid
                revenue[cid] = revenue.get(cid, 0) + (s.get('amount') or 0)
            identified, registered = set(idf), set(reg)
            return {'identified': identified, 'registered': registered, 'abandoned': identified - registered,
                    'buyers': set(revenue), 'revenue': revenue, 'sales': sales}
        return await cached('status_sets', 300, compute, wait=None)

    async def page_visitor_ids(f: Filters):
        """With a page / host filter, contact metrics only count people who visited those pages in the period."""
        if not (f.pages or f.hosts):
            return None

        async def compute():
            rows = await agg('page_visits', [{'$match': f.visit_match()}, {'$group': {'_id': '$contact_id'}}])
            return [x['_id'] for x in rows]
        return await cached('pvids|' + f.key(), 180, compute, wait=None)

    async def contact_match(f: Filters, field='created_at', since=None, until=None):
        s, e = f.bounds(since, until)
        m = {'merged_into': None, field: {'$gte': s, '$lt': e}, **f.attr_match()}
        ids = await page_visitor_ids(f)
        if ids is not None:
            m['contact_id'] = {'$in': ids}
        return m

    async def filtered_linked(coll, date_field, f: Filters, extra=None):
        """Registrations / sales in the period, honouring attribution and page filters via their contact."""
        s, e = f.bounds()
        first = {date_field: {'$gte': s, '$lt': e}, **(extra or {})}
        ids = await page_visitor_ids(f)
        if ids is not None:
            first['contact_id'] = {'$in': ids}
        pipe = [{'$match': first}]
        if f.has_attr:
            pipe += [{'$lookup': {'from': 'contacts', 'localField': 'contact_id', 'foreignField': 'contact_id', 'as': 'c',
                                  'pipeline': [{'$project': {'_id': 0, 'attribution': 1}}]}},
                     {'$unwind': '$c'}, {'$match': f.attr_match('c.')}]
        return pipe

    def identified_match(base_s, base_e):
        return {'$or': [{'first_identified_at': {'$gte': base_s, '$lt': base_e}},
                        {'first_identified_at': {'$exists': False}, 'created_at': {'$gte': base_s, '$lt': base_e},
                         '$or': [{'email': KNOWN}, {'phone': KNOWN}]}]}

    IDF_DATE = {'$ifNull': ['$first_identified_at', '$created_at']}

    # ── overview: headline KPIs for the period and the one before ──
    async def kpis(f: Filters):
        vm = f.visit_match()
        s, e = f.bounds()
        cm = await contact_match(f)
        im = {**cm, **identified_match(s, e)}
        im.pop('created_at', None)
        sessions_pipe = [{'$match': vm}, {'$group': {'_id': '$session_id', 'n': {'$sum': 1}, 'a': {'$min': '$timestamp'}, 'b': {'$max': '$timestamp'}}},
                         {'$group': {'_id': None, 'sessions': {'$sum': 1}, 'views': {'$sum': '$n'},
                                     'bounces': {'$sum': {'$cond': [{'$eq': ['$n', 1]}, 1, 0]}},
                                     'dur': {'$median': {'method': 'approximate', 'input': {'$cond': [{'$gt': ['$n', 1]}, {'$dateDiff': {
                                         'startDate': {'$dateFromString': {'dateString': '$a', 'onError': None, 'onNull': None}},
                                         'endDate': {'$dateFromString': {'dateString': '$b', 'onError': None, 'onNull': None}}, 'unit': 'second'}}, None]}}},
                                     'multi': {'$sum': {'$cond': [{'$gt': ['$n', 1]}, 1, 0]}}}}]
        visitors_pipe = [{'$match': vm}, {'$group': {'_id': '$contact_id'}}, {'$count': 'n'}]
        reg_pipe = await filtered_linked('stealth_registrations', 'registered_at', f) + [{'$count': 'n'}]
        sale_pipe = await filtered_linked('sales', 'created_at', f, {'status': {'$nin': BAD_SALE}}) + [
            {'$group': {'_id': None, 'n': {'$sum': 1}, 'rev': {'$sum': '$amount'}, 'buyers': {'$addToSet': '$contact_id'}}}]
        idf_pipe = [{'$match': im}, {'$group': {'_id': None, 'n': {'$sum': 1},
                                                'abandoned': {'$sum': {'$cond': [REGISTERED, 0, 1]}}}}]
        sess, vis, new, reg, sale, idf = await asyncio.gather(
            agg('page_visits', sessions_pipe), agg('page_visits', visitors_pipe), count(cm),
            agg('stealth_registrations', reg_pipe), agg('sales', sale_pipe), agg('contacts', idf_pipe, ch(im)))
        sess = sess[0] if sess else {}
        visitors = vis[0]['n'] if vis else 0
        sessions = sess.get('sessions', 0)
        new_v = min(new, visitors)
        identified = idf[0]['n'] if idf else 0
        registrations = reg[0]['n'] if reg else 0
        sale = sale[0] if sale else {}
        return {
            'visits': sess.get('views', 0), 'visitors': visitors, 'sessions': sessions,
            'new_visitors': new_v, 'returning_visitors': max(visitors - new_v, 0),
            'bounce_rate': rate(sess.get('bounces', 0), sessions),
            'pages_per_session': round(sess.get('views', 0) / sessions, 2) if sessions else None,
            'avg_session_seconds': round(sess['dur']) if sess.get('dur') is not None else None,   # median, multi-page sessions
            'new_contacts': new, 'identified': identified, 'abandoned': idf[0]['abandoned'] if idf else 0,
            'registrations': registrations, 'sales': sale.get('n', 0), 'revenue': round(sale.get('rev', 0) or 0, 2),
            'buyers': len(sale.get('buyers', [])),
            # registration rate: of the leads identified in the period, the share who registered
            'identification_rate': rate(identified, visitors), 'registration_rate': rate(identified - (idf[0]['abandoned'] if idf else 0), identified),
            'purchase_rate': rate(sale.get('n', 0), registrations),
        }

    @r.get('/overview')
    async def overview(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                       source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                       content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                       host: Optional[str] = None, compare: int = 0):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            p = f.previous()
            # The previous period only when comparing — it doubles the work.
            cur, prev = await asyncio.gather(kpis(f), kpis(p)) if compare else (await kpis(f), None)
            return {'range': {'since': f.since.isoformat(), 'until': f.until.isoformat(), 'days': f.days},
                    'previous_range': {'since': p.since.isoformat(), 'until': p.until.isoformat()},
                    'current': cur, 'previous': prev}
        return await cached(f'overview|{int(bool(compare))}|' + f.key(), 120, compute)

    # ── time series ──
    @r.get('/timeseries')
    async def timeseries(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                         source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                         content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                         host: Optional[str] = None, granularity: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)
        gran = granularity if granularity in GRAN else auto_gran(f.days)
        if gran == 'hour' and f.days > 31:
            gran = 'day'

        async def compute():
            s, e = f.bounds()
            vm = f.visit_match()
            vb = bucket_expr('timestamp', gran, f.tz)
            cm = await contact_match(f)
            im = {**cm, **identified_match(s, e)}
            im.pop('created_at', None)
            reg_pipe = await filtered_linked('stealth_registrations', 'registered_at', f)
            sale_pipe = await filtered_linked('sales', 'created_at', f, {'status': {'$nin': BAD_SALE}})
            visits, sessions, new, idf, regs, sales = await asyncio.gather(
                agg('page_visits', [{'$match': vm}, {'$group': {'_id': {'b': vb, 'c': '$contact_id'}, 'n': {'$sum': 1}}},
                                    {'$group': {'_id': '$_id.b', 'visits': {'$sum': '$n'}, 'visitors': {'$sum': 1}}}]),
                agg('page_visits', [{'$match': vm}, {'$group': {'_id': {'b': vb, 's': '$session_id'}, 'n': {'$sum': 1}}},
                                    {'$group': {'_id': '$_id.b', 'sessions': {'$sum': 1},
                                                'bounces': {'$sum': {'$cond': [{'$eq': ['$n', 1]}, 1, 0]}}}}]),
                agg('contacts', [{'$match': cm}, {'$group': {'_id': bucket_expr('created_at', gran, f.tz), 'n': {'$sum': 1}}}], ch(cm)),
                agg('contacts', [{'$match': im}, {'$set': {'_d': IDF_DATE}},
                                 {'$group': {'_id': bucket_expr('_d', gran, f.tz), 'n': {'$sum': 1},
                                             'abandoned': {'$sum': {'$cond': [REGISTERED, 0, 1]}}}}], ch(im)),
                agg('stealth_registrations', reg_pipe + [{'$group': {'_id': bucket_expr('registered_at', gran, f.tz), 'n': {'$sum': 1}}}]),
                agg('sales', sale_pipe + [{'$group': {'_id': bucket_expr('created_at', gran, f.tz), 'n': {'$sum': 1}, 'rev': {'$sum': '$amount'}}}]))
            by = lambda rows: {x['_id']: x for x in rows}
            V, S, N, I, R, P = map(by, (visits, sessions, new, idf, regs, sales))
            out = []
            for k in bucket_keys(f, gran):
                v = V.get(k, {})
                visitors = v.get('visitors', 0)
                new_v = min(N.get(k, {}).get('n', 0), visitors)
                sess = S.get(k, {})
                out.append({'bucket': k, 'visits': v.get('visits', 0), 'visitors': visitors,
                            'sessions': sess.get('sessions', 0),
                            'bounce_rate': rate(sess.get('bounces', 0), sess.get('sessions', 0)),
                            'new_visitors': new_v, 'returning_visitors': max(visitors - new_v, 0),
                            'new_contacts': N.get(k, {}).get('n', 0),
                            'identified': I.get(k, {}).get('n', 0), 'abandoned': I.get(k, {}).get('abandoned', 0),
                            'registrations': R.get(k, {}).get('n', 0),
                            'sales': P.get(k, {}).get('n', 0), 'revenue': round(P.get(k, {}).get('rev', 0) or 0, 2)})
            return {'granularity': gran, 'series': out}
        return await cached(f'ts|{gran}|' + f.key(), 120, compute)

    # ── generic breakdown (the explorer) ──
    async def visit_breakdown(f: Filters, dim, limit, sort):
        key = visit_dim(dim, f.tz)
        vm = f.visit_match()
        sets = await status_sets()

        known = sets['identified'] | sets['registered'] | sets['buyers']
        base, pairs = await asyncio.gather(
            agg('page_visits', [{'$match': vm}, {'$group': {'_id': {'k': key, 'c': '$contact_id'}, 'n': {'$sum': 1}}},
                                {'$group': {'_id': '$_id.k', 'views': {'$sum': '$n'}, 'visitors': {'$sum': 1}}}]),
            # visitors who are known people: one pass over their visits, classified here
            agg('page_visits', [{'$match': {**vm, 'contact_id': {'$in': sorted(known)}}},
                                {'$group': {'_id': {'k': key, 'c': '$contact_id'}}}]))
        I, R, A, B = {}, {}, {}, {}
        for x in pairs:
            k, c = x['_id'].get('k'), x['_id']['c']
            for bucket, group in ((I, 'identified'), (R, 'registered'), (A, 'abandoned'), (B, 'buyers')):
                if c in sets[group]:
                    bucket[k] = bucket.get(k, 0) + 1
        rows = []
        for x in base:
            k = x['_id']
            rows.append({'key': label_value(dim, k), 'raw': k, 'views': x['views'], 'visitors': x['visitors'],
                         'views_per_visitor': round(x['views'] / x['visitors'], 2) if x['visitors'] else None,
                         'identified': I.get(k, 0), 'registered': R.get(k, 0), 'abandoned': A.get(k, 0), 'buyers': B.get(k, 0),
                         'identification_rate': rate(I.get(k, 0), x['visitors']),
                         'registration_rate': rate(R.get(k, 0), x['visitors']),
                         'abandon_rate': rate(A.get(k, 0), I.get(k, 0))})
        return rows

    async def contact_breakdown(f: Filters, dim, limit, sort):
        key = contact_dim(dim, f.tz)
        cm = await contact_match(f)
        sets = await status_sets()
        buyer_ids = sets['buyers'] if 'contact_id' not in cm else sets['buyers'] & set(cm['contact_id']['$in'])
        base, buyers = await asyncio.gather(
            agg('contacts', [{'$match': cm}, {'$group': {
                '_id': key, 'contacts': {'$sum': 1},
                'identified': {'$sum': {'$cond': [IDENTIFIED, 1, 0]}},
                'registered': {'$sum': {'$cond': [REGISTERED, 1, 0]}},
                'abandoned': {'$sum': {'$cond': [{'$and': [IDENTIFIED, {'$not': [REGISTERED]}]}, 1, 0]}}}}], ch(cm)),
            agg('contacts', [{'$match': {**cm, 'contact_id': {'$in': list(buyer_ids)}}},
                             {'$group': {'_id': key, 'ids': {'$push': '$contact_id'}}}], 'contact_id_1'))
        B = {x['_id']: x['ids'] for x in buyers}
        rows = []
        for x in base:
            k = x['_id']
            ids = B.get(k, [])
            rev = round(sum(sets['revenue'].get(i, 0) for i in ids), 2)
            rows.append({'key': label_value(dim, k), 'raw': k, 'contacts': x['contacts'], 'identified': x['identified'],
                         'registered': x['registered'], 'abandoned': x['abandoned'], 'anonymous': x['contacts'] - x['identified'],
                         'buyers': len(ids), 'revenue': rev,
                         'identification_rate': rate(x['identified'], x['contacts']),
                         'registration_rate': rate(x['registered'], x['identified']),
                         'abandon_rate': rate(x['abandoned'], x['identified']),
                         'purchase_rate': rate(len(ids), x['registered'] or x['identified']),
                         'revenue_per_contact': round(rev / x['contacts'], 2) if x['contacts'] else None})
        return rows

    @r.get('/breakdown')
    async def breakdown(dimension: str, base: str = 'contacts', sort: Optional[str] = None, limit: int = Query(25, le=500),
                        min_size: int = 0,
                        since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                        source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                        content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                        host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)
        if base == 'visits' and dimension not in VISIT_DIMS or base == 'contacts' and dimension not in CONTACT_DIMS or base not in ('visits', 'contacts'):
            raise HTTPException(status_code=400, detail=f'Unsupported dimension {dimension!r} for {base}')

        async def compute():
            rows = await (visit_breakdown if base == 'visits' else contact_breakdown)(f, dimension, limit, sort)
            return rows
        rows = await cached(f'bd|{base}|{dimension}|' + f.key(), 180, compute)
        size_key = 'visitors' if base == 'visits' else 'contacts'
        sort_key = sort or ('views' if base == 'visits' else 'contacts')
        rows = [x for x in rows if x[size_key] >= min_size]
        if dimension in ('weekday', 'hour'):
            rows = sorted(rows, key=lambda x: x['raw'] if isinstance(x['raw'], int) else 99)
        else:
            rows = sorted(rows, key=lambda x: (x.get(sort_key) is None, -(x.get(sort_key) or 0)))
        total = {}
        for x in rows:
            for k, v in x.items():
                if isinstance(v, (int, float)) and not k.endswith('_rate') and k not in ('raw', 'views_per_visitor', 'revenue_per_contact'):
                    total[k] = total.get(k, 0) + v
        return {'dimension': dimension, 'label': DIM_LABELS[dimension], 'base': base, 'total_rows': len(rows),
                'rows': rows[:limit] if dimension not in ('weekday', 'hour') else rows, 'totals': total}

    # ── breakdown over time: the top N values of a dimension as series ──
    @r.get('/breakdown/trend')
    async def breakdown_trend(dimension: str, base: str = 'visits', metric: Optional[str] = None, top: int = Query(5, le=10),
                              granularity: Optional[str] = None,
                              since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                              source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                              content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                              host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)
        gran = granularity if granularity in GRAN else auto_gran(f.days)
        if gran == 'hour' and f.days > 31:
            gran = 'day'
        if base == 'visits' and dimension not in VISIT_DIMS or base == 'contacts' and dimension not in CONTACT_DIMS:
            raise HTTPException(status_code=400, detail='Unsupported dimension')

        async def compute():
            if base == 'visits':
                key, b = visit_dim(dimension, f.tz), bucket_expr('timestamp', gran, f.tz)
                match = f.visit_match()
                pipe = [{'$match': match}, {'$group': {'_id': {'k': key, 'b': b, 'c': '$contact_id'}, 'n': {'$sum': 1}}},
                        {'$group': {'_id': {'k': '$_id.k', 'b': '$_id.b'}, 'visits': {'$sum': '$n'}, 'visitors': {'$sum': 1}}}]
                coll, m = 'page_visits', metric if metric in ('visits', 'visitors') else 'visitors'
            else:
                key, b = contact_dim(dimension, f.tz), bucket_expr('created_at', gran, f.tz)
                match = await contact_match(f)
                pipe = [{'$match': match}, {'$group': {'_id': {'k': key, 'b': b}, 'contacts': {'$sum': 1},
                                                       'identified': {'$sum': {'$cond': [IDENTIFIED, 1, 0]}},
                                                       'registered': {'$sum': {'$cond': [REGISTERED, 1, 0]}},
                                                       'abandoned': {'$sum': {'$cond': [{'$and': [IDENTIFIED, {'$not': [REGISTERED]}]}, 1, 0]}}}}]
                coll, m = 'contacts', metric if metric in ('contacts', 'identified', 'registered', 'abandoned') else 'contacts'
            rows = await agg(coll, pipe, ch(match) if coll == 'contacts' else None)
            totals = {}
            for x in rows:
                totals[x['_id']['k']] = totals.get(x['_id']['k'], 0) + x[m]
            keys = [k for k, _ in sorted(totals.items(), key=lambda kv: -kv[1])[:top]]
            grid = {(x['_id']['k'], x['_id']['b']): x[m] for x in rows}
            series = [{'bucket': bk, **{str(label_value(dimension, k)): grid.get((k, bk), 0) for k in keys},
                       'Other': sum(v for (k, b2), v in grid.items() if b2 == bk and k not in keys)}
                      for bk in bucket_keys(f, gran)]
            return {'granularity': gran, 'metric': m, 'keys': [str(label_value(dimension, k)) for k in keys] + ['Other'], 'series': series}
        return await cached(f'bdt|{base}|{dimension}|{metric}|{top}|{gran}|' + f.key(), 180, compute)

    # ── pages: views, visitors, entries, exits, bounces, time, lead status of visitors ──
    @r.get('/pages')
    async def pages(limit: int = Query(30, le=200), since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                    source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                    content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                    host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            vm = f.visit_match()
            rows, sessions, titles = await asyncio.gather(
                visit_breakdown(f, 'page', limit, 'views'),
                agg('page_visits', [{'$match': vm}, {'$project': {'s': '$session_id', 't': '$timestamp', 'p': PAGE}},
                                    {'$group': {'_id': '$s', 'first': {'$top': {'sortBy': {'t': 1}, 'output': '$p'}},
                                                'last': {'$bottom': {'sortBy': {'t': 1}, 'output': '$p'}}, 'n': {'$sum': 1},
                                                'a': {'$min': '$t'}, 'b': {'$max': '$t'}}},
                                    {'$set': {'dur': {'$dateDiff': {'startDate': {'$dateFromString': {'dateString': '$a', 'onError': None, 'onNull': None}},
                                                                    'endDate': {'$dateFromString': {'dateString': '$b', 'onError': None, 'onNull': None}}, 'unit': 'second'}}}},
                                    {'$facet': {
                                        'entries': [{'$group': {'_id': '$first', 'entries': {'$sum': 1},
                                                                'bounces': {'$sum': {'$cond': [{'$eq': ['$n', 1]}, 1, 0]}},
                                                                'dur': {'$median': {'method': 'approximate', 'input': {'$cond': [{'$gt': ['$n', 1]}, '$dur', None]}}},
                                                                'multi': {'$sum': {'$cond': [{'$gt': ['$n', 1]}, 1, 0]}},
                                                                'depth': {'$sum': '$n'}}}],
                                        'exits': [{'$match': {'n': {'$gt': 1}}}, {'$group': {'_id': '$last', 'exits': {'$sum': 1}}}]}}]),
                agg('page_visits', [{'$match': {**vm, 'page_title': KNOWN}}, {'$group': {'_id': {'p': PAGE, 't': '$page_title'}, 'n': {'$sum': 1}}},
                                    {'$sort': {'n': -1}}, {'$group': {'_id': '$_id.p', 'title': {'$first': '$_id.t'}}}]))
            E = {x['_id']: x for x in sessions[0]['entries']} if sessions else {}
            X = {x['_id']: x['exits'] for x in sessions[0]['exits']} if sessions else {}
            T = {x['_id']: x['title'] for x in titles}
            for x in rows:
                e = E.get(x['raw'], {})
                x.update({'title': T.get(x['raw']), 'entries': e.get('entries', 0), 'bounces': e.get('bounces', 0),
                          'bounce_rate': rate(e.get('bounces', 0), e.get('entries', 0)),
                          'avg_session_seconds': round(e['dur']) if e.get('dur') is not None else None,   # median
                          'pages_per_session': round(e['depth'] / e['entries'], 2) if e.get('entries') else None,
                          'exits': X.get(x['raw'], 0)})
            rows.sort(key=lambda x: -x['views'])
            hosts = {}
            for x in rows:
                h = x['raw'].split('/')[0] or '(unknown)'
                hosts.setdefault(h, {'host': h, 'views': 0, 'pages': 0})
                hosts[h]['views'] += x['views']
                hosts[h]['pages'] += 1
            return {'rows': rows, 'hosts': sorted(hosts.values(), key=lambda h: -h['views'])}
        res = await cached('pages|' + f.key(), 180, compute)
        return {'rows': res['rows'][:limit], 'total_rows': len(res['rows']), 'hosts': res['hosts']}

    # ── page flow: where visitors go next from a page ──
    @r.get('/pages/flow')
    async def page_flow(page: str, limit: int = Query(10, le=50), since: Optional[str] = None, until: Optional[str] = None,
                        tz: str = 'UTC', source: Optional[str] = None, medium: Optional[str] = None,
                        campaign: Optional[str] = None, content: Optional[str] = None, term: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, None, None)
        target = page.lower().rstrip('/')

        async def compute():
            pipe = [{'$match': f.visit_match()}, {'$project': {'s': '$session_id', 't': '$timestamp', 'p': PAGE}},
                    {'$setWindowFields': {'partitionBy': '$s', 'sortBy': {'t': 1}, 'output': {
                        'prev': {'$shift': {'output': '$p', 'by': -1, 'default': '(entrance)'}},
                        'next': {'$shift': {'output': '$p', 'by': 1, 'default': '(exit)'}}}}},
                    {'$match': {'p': target}},
                    {'$facet': {'prev': [{'$group': {'_id': '$prev', 'n': {'$sum': 1}}}, {'$sort': {'n': -1}}, {'$limit': limit}],
                                'next': [{'$group': {'_id': '$next', 'n': {'$sum': 1}}}, {'$sort': {'n': -1}}, {'$limit': limit}],
                                'total': [{'$count': 'n'}]}}]
            res = (await agg('page_visits', pipe))[0]
            return {'page': target, 'views': res['total'][0]['n'] if res['total'] else 0,
                    'previous': [{'page': x['_id'], 'count': x['n']} for x in res['prev']],
                    'next': [{'page': x['_id'], 'count': x['n']} for x in res['next']]}
        return await cached(f'flow|{target}|{limit}|' + f.key(), 180, compute)

    # ── visitor loyalty: frequency, recency, return gaps, top returning people ──
    @r.get('/visitors')
    async def visitors(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                       source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                       content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                       host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            vm = f.visit_match()
            s, _ = f.bounds()
            day = {'$dateToString': {'date': to_date('timestamp'), 'format': '%Y-%m-%d', 'timezone': f.tz}}
            per = await agg('page_visits', [{'$match': vm},
                                            {'$group': {'_id': '$contact_id', 'n': {'$sum': 1}, 'days': {'$addToSet': day},
                                                        'sessions': {'$addToSet': '$session_id'},
                                                        'ts': {'$minN': {'n': 2, 'input': '$timestamp'}}, 'last': {'$max': '$timestamp'}}},
                                            {'$project': {'n': 1, 'last': 1, 'days': {'$size': '$days'}, 'sessions': {'$size': '$sessions'},
                                                          'gap': {'$cond': [{'$eq': [{'$size': '$ts'}, 2]}, {'$dateDiff': {
                                                              'startDate': {'$dateFromString': {'dateString': {'$min': '$ts'}, 'onError': None}},
                                                              'endDate': {'$dateFromString': {'dateString': {'$max': '$ts'}, 'onError': None}},
                                                              'unit': 'minute'}}, None]}}}])
            # Returning = first seen before the period. Only those contacts are looked up (none when the period
            # starts before the first contact).
            created = {}
            first_seen = await cached('first_created', 3600, lambda: _first_created(), wait=None)
            if first_seen and s > first_seen:
                ids = [x['_id'] for x in per]
                sem = asyncio.Semaphore(4)

                async def chunk(part):
                    async with sem:
                        return await db.contacts.find({'contact_id': {'$in': part}, 'created_at': {'$lt': s}},
                                                      {'_id': 0, 'contact_id': 1, 'created_at': 1}, hint='contact_id_1').to_list(None)
                for part in await asyncio.gather(*[chunk(ids[i:i + 5000]) for i in range(0, len(ids), 5000)]):
                    for d in part:
                        created[d['contact_id']] = d.get('created_at')
            sets = await status_sets()
            new = [x for x in per if x['_id'] not in created]
            ret = [x for x in per if x['_id'] in created]
            gaps = [x['gap'] / 60 for x in per if x.get('gap') is not None and x['gap'] >= 30]   # ignore same-visit reloads
            since_first = []
            for x in ret:
                try:
                    since_first.append((datetime.fromisoformat(x['last']) - datetime.fromisoformat(created[x['_id']])).total_seconds() / 86400)
                except (TypeError, ValueError):
                    pass

            def seg(group):
                n = len(group)
                idf = sum(1 for x in group if x['_id'] in sets['identified'])
                reg = sum(1 for x in group if x['_id'] in sets['registered'])
                buy = sum(1 for x in group if x['_id'] in sets['buyers'])
                return {'visitors': n, 'visits': sum(x['n'] for x in group),
                        'visits_per_visitor': round(sum(x['n'] for x in group) / n, 2) if n else None,
                        'identified': idf, 'registered': reg, 'buyers': buy,
                        'identification_rate': rate(idf, n), 'registration_rate': rate(reg, n), 'purchase_rate': rate(buy, n)}

            top = sorted(per, key=lambda x: -x['n'])[:200]
            top_ids = [x['_id'] for x in top if x['_id'] in sets['identified']][:25]
            people = {d['contact_id']: d for d in await db.contacts.find(
                {'contact_id': {'$in': top_ids}}, {'_id': 0, 'contact_id': 1, 'name': 1, 'email': 1, 'tags': 1, 'attribution.utm_source': 1}).to_list(None)}
            P = {x['_id']: x for x in per}
            return {
                'new': seg(new), 'returning': seg(ret),
                'frequency': hist([x['n'] for x in per], [1, 2, 3, 4, 6, 11, 21, 51, 10 ** 9],
                                  ['1', '2', '3', '4–5', '6–10', '11–20', '21–50', '51+']),
                'days_active': hist([x['days'] for x in per], [1, 2, 3, 4, 8, 15, 10 ** 9], ['1 day', '2', '3', '4–7', '8–14', '15+']),
                'sessions': hist([x['sessions'] for x in per], [1, 2, 3, 4, 6, 11, 10 ** 9], ['1', '2', '3', '4–5', '6–10', '11+']),
                'return_gap': hist(gaps, [0, 1, 6, 24, 72, 168, 720, 10 ** 9],
                                   ['< 1 hour', '1–6 hours', '6–24 hours', '1–3 days', '3–7 days', '1–4 weeks', '4+ weeks']),
                'loyalty_age': hist(since_first, [0, 1, 7, 30, 90, 10 ** 9], ['< 1 day', '1–7 days', '1–4 weeks', '1–3 months', '3+ months']),
                'top': [{'contact_id': cid, 'name': people[cid].get('name'), 'email': people[cid].get('email'),
                         'source': (people[cid].get('attribution') or {}).get('utm_source'),
                         'registered': cid in sets['registered'], 'buyer': cid in sets['buyers'],
                         'visits': P[cid]['n'], 'days': P[cid]['days'], 'last': P[cid]['last']}
                        for cid in top_ids if cid in people],
            }
        return await cached('visitors|' + f.key(), 180, compute)

    async def _first_created():
        d = await db.contacts.find_one({}, {'_id': 0, 'created_at': 1}, sort=[('created_at', 1)])
        return d and d.get('created_at')

    # ── heatmap: weekday × hour ──
    @r.get('/heatmap')
    async def heatmap(metric: str = 'visits', since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                      source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                      content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                      host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            s, e = f.bounds()
            if metric == 'identified':
                cm = await contact_match(f)
                m = {**cm, **identified_match(s, e)}
                m.pop('created_at', None)
                coll, field, pre = 'contacts', '_d', [{'$match': m}, {'$set': {'_d': IDF_DATE}}]
            elif metric == 'registrations':
                coll, field, pre = 'stealth_registrations', 'registered_at', await filtered_linked('stealth_registrations', 'registered_at', f)
            elif metric == 'sales':
                coll, field, pre = 'sales', 'created_at', await filtered_linked('sales', 'created_at', f, {'status': {'$nin': BAD_SALE}})
            else:
                coll, field, pre = 'page_visits', 'timestamp', [{'$match': f.visit_match()}]
            d = to_date(field)
            rows = await agg(coll, pre + [{'$group': {'_id': {'d': {'$dayOfWeek': {'date': d, 'timezone': f.tz}},
                                                               'h': {'$hour': {'date': d, 'timezone': f.tz}}}, 'n': {'$sum': 1}}}])
            grid = [[0] * 24 for _ in range(7)]
            for x in rows:
                if x['_id']['d'] and x['_id']['h'] is not None:
                    grid[(x['_id']['d'] + 5) % 7][x['_id']['h']] = x['n']     # Monday first
            return {'metric': metric, 'days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 'grid': grid}
        return await cached(f'heat|{metric}|' + f.key(), 180, compute)

    # ── funnel: what the people first seen in the period went on to do ──
    @r.get('/funnel')
    async def funnel(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                     source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                     content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                     host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            cm = await contact_match(f)
            s, _ = f.bounds()
            sets = await status_sets()
            cohort, returned = await asyncio.gather(
                agg('contacts', [{'$match': cm}, {'$group': {'_id': None, 'n': {'$sum': 1},
                                                             'identified': {'$sum': {'$cond': [IDENTIFIED, 1, 0]}},
                                                             'registered': {'$sum': {'$cond': [REGISTERED, 1, 0]}},
                                                             'ids': {'$push': {'$cond': [IDENTIFIED, '$contact_id', '$$REMOVE']}}}}], ch(cm)),
                agg('page_visits', [{'$match': {'timestamp': {'$gte': s}}},
                                    {'$group': {'_id': '$contact_id', 'd': {'$addToSet': {'$substrCP': ['$timestamp', 0, 10]}}}},
                                    {'$match': {'d.1': {'$exists': True}}}, {'$project': {'_id': 1}}]))
            c = cohort[0] if cohort else {'n': 0, 'identified': 0, 'registered': 0, 'ids': []}
            cohort_ids = {d['contact_id'] for d in await db.contacts.find(cm, {'_id': 0, 'contact_id': 1}, **({'hint': ch(cm)} if ch(cm) else {})).to_list(None)}
            came_back = sum(1 for x in returned if x['_id'] in cohort_ids)
            buyers = sum(1 for i in c['ids'] if i in sets['buyers'])
            revenue = round(sum(sets['revenue'].get(i, 0) for i in c['ids']), 2)
            steps = [('First visit', c['n']), ('Came back another day', came_back), ('Identified', c['identified']),
                     ('Registered', c['registered']), ('Purchased', buyers)]
            return {'steps': [{'step': n, 'count': v, 'of_total': rate(v, c['n']),
                               'of_previous': rate(v, steps[i - 1][1]) if i else 1} for i, (n, v) in enumerate(steps)],
                    'revenue': revenue, 'abandoned': c['identified'] - c['registered']}
        return await cached('funnel|' + f.key(), 180, compute)

    # ── conversion timing: how long each step takes ──
    @r.get('/timing')
    async def timing(since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                     source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                     content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                     host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)

        async def compute():
            cm = await contact_match(f)
            sets = await status_sets()
            edges = [0, 1, 6, 24, 72, 168, 720, 10 ** 9]
            labels = ['< 1 hour', '1–6 hours', '6–24 hours', '1–3 days', '3–7 days', '1–4 weeks', '4+ weeks']
            to_idf = await agg('contacts', [{'$match': {**cm, 'first_identified_at': KNOWN}},
                                            {'$project': {'h': {'$dateDiff': {'startDate': to_date('created_at'),
                                                                              'endDate': to_date('first_identified_at'), 'unit': 'minute'}}}}], ch(cm))
            created = {d['contact_id']: d.get('created_at') for d in await db.contacts.find(
                cm, {'_id': 0, 'contact_id': 1, 'created_at': 1}, **({'hint': ch(cm)} if ch(cm) else {})).to_list(None)}
            first_reg = {}
            for x in await db.stealth_registrations.find({'contact_id': KNOWN}, {'_id': 0, 'contact_id': 1, 'registered_at': 1}).to_list(None):
                cid, at = x['contact_id'], x.get('registered_at')
                if cid in created and at and (cid not in first_reg or at < first_reg[cid]):
                    first_reg[cid] = at
            first_sale = {}
            for sale in sets['sales']:
                cid = sale['contact_id']
                if cid in created and sale.get('created_at') and (cid not in first_sale or sale['created_at'] < first_sale[cid]):
                    first_sale[cid] = sale['created_at']

            def hours(a, b):
                try:
                    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 3600
                except (TypeError, ValueError):
                    return None
            buy_h = [h for h in (hours(created[c], t) for c, t in first_sale.items()) if h is not None]
            touches = []
            if first_sale:
                rows = await agg('page_visits', [{'$match': {'contact_id': {'$in': list(first_sale)}}},
                                                 {'$group': {'_id': '$contact_id', 'ts': {'$push': '$timestamp'}}}])
                for x in rows:
                    touches.append(sum(1 for t in x['ts'] if t <= first_sale[x['_id']]))
            reg_h = [h for h in (hours(created[c], r) for c, r in first_reg.items()) if h is not None]

            def med(v):
                v = sorted(v)
                return round(v[len(v) // 2], 1) if v else None
            idf_h = [x['h'] / 60 for x in to_idf if x['h'] is not None and x['h'] >= 0]
            reg_h = [h for h in reg_h if h >= 0]
            buy_h = [h for h in buy_h if h >= 0]
            return {
                'to_identify': {'histogram': hist(idf_h, edges, labels), 'median_hours': med(idf_h), 'n': len(idf_h),
                                'note': 'First seen → first email/phone (contacts identified since identification times were recorded).'},
                'to_register': {'histogram': hist(reg_h, edges, labels), 'median_hours': med(reg_h), 'n': len(reg_h)},
                'to_purchase': {'histogram': hist(buy_h, edges, labels), 'median_hours': med(buy_h), 'n': len(buy_h)},
                'visits_before_purchase': {'histogram': hist(touches, [0, 2, 3, 4, 6, 11, 21, 10 ** 9], ['1', '2', '3', '4–5', '6–10', '11–20', '21+']),
                                           'median': med(touches), 'n': len(touches)},
            }
        return await cached('timing|' + f.key(), 300, compute)

    # ── cohorts: people grouped by first-seen week / month, and what they did since ──
    @r.get('/cohorts')
    async def cohorts(period: str = 'week', count: int = Query(10, ge=2, le=26), tz: str = 'UTC',
                      source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                      content: Optional[str] = None, term: Optional[str] = None):
        if period not in ('week', 'month'):
            raise HTTPException(status_code=400, detail='period must be week or month')
        f = common(None, None, tz, source, medium, campaign, content, term, None, None)
        today = f.until
        if period == 'week':
            first = today - timedelta(days=today.weekday()) - timedelta(weeks=count - 1)
        else:
            m = today.replace(day=1)
            for _ in range(count - 1):
                m = (m - timedelta(days=1)).replace(day=1)
            first = m
        f.since = first

        async def compute():
            s, _ = f.bounds()
            sets = await status_sets()
            b = lambda field: bucket_expr(field, period, f.tz)
            members = await agg('contacts', [{'$match': {'merged_into': None, 'created_at': {'$gte': s}, **f.attr_match()}},
                                             {'$project': {'_id': 0, 'c': '$contact_id', 'k': b('created_at'),
                                                           'i': IDENTIFIED, 'r': REGISTERED}}])
            cohort_of = {m['c']: m['k'] for m in members}
            activity = await agg('page_visits', [{'$match': {'timestamp': {'$gte': s}}},
                                                 {'$group': {'_id': {'c': '$contact_id', 'k': b('timestamp')}}}])
            keys = bucket_keys(f, period)
            idx = {k: i for i, k in enumerate(keys)}
            active = {}
            for a in activity:
                ck = cohort_of.get(a['_id']['c'])
                if ck is None or a['_id']['k'] not in idx:
                    continue
                off = idx[a['_id']['k']] - idx.get(ck, 0)
                if off >= 0:
                    active[(ck, off)] = active.get((ck, off), 0) + 1
            rows = []
            for k in keys:
                mem = [m for m in members if m['k'] == k]
                n = len(mem)
                ids = [m['c'] for m in mem]
                rev = sum(sets['revenue'].get(i, 0) for i in ids)
                rows.append({'cohort': k, 'size': n,
                             'identified': rate(sum(1 for m in mem if m['i']), n),
                             'registered': rate(sum(1 for m in mem if m['r']), n),
                             'buyers': rate(sum(1 for i in ids if i in sets['buyers']), n),
                             'revenue': round(rev, 2),
                             'retention': [rate(active.get((k, o), 0), n) for o in range(len(keys) - idx[k])]})
            return {'period': period, 'rows': rows}
        return await cached(f'cohorts|{period}|{count}|' + f.key(), 600, compute)

    # ── abandoned leads: identified but never registered ──
    async def abandoned_visits(m):
        """Last page seen and visit count for each abandoned lead, from their visits (contact_id index)."""
        ids = [d['contact_id'] for d in await db.contacts.find(m, {'_id': 0, 'contact_id': 1}, **({'hint': ch(m)} if ch(m) else {})).to_list(None)]
        if not ids:
            return [], []
        per = await agg('page_visits', [{'$match': {'contact_id': {'$in': ids}}},
                                        {'$group': {'_id': '$contact_id', 'n': {'$sum': 1},
                                                    'url': {'$bottom': {'sortBy': {'timestamp': 1}, 'output': '$current_url'}}}},
                                        {'$project': {'n': 1, 'current_url': '$url'}},
                                        {'$facet': {'pages': [{'$group': {'_id': PAGE, 'n': {'$sum': 1}}}, {'$sort': {'n': -1}}, {'$limit': 12}],
                                                    'counts': [{'$project': {'_id': 0, 'n': 1}}]}}], 'contact_id_1_timestamp_1')
        counts = [x['n'] for x in per[0]['counts']] + [0] * (len(ids) - len(per[0]['counts']))
        return per[0]['pages'], [{'n': n} for n in counts]

    @r.get('/abandoned')
    async def abandoned(q: Optional[str] = None, offset: int = 0, limit: int = Query(50, le=5000),
                        since: Optional[str] = None, until: Optional[str] = None, tz: str = 'UTC',
                        source: Optional[str] = None, medium: Optional[str] = None, campaign: Optional[str] = None,
                        content: Optional[str] = None, term: Optional[str] = None, page: Optional[str] = None,
                        host: Optional[str] = None):
        f = common(since, until, tz, source, medium, campaign, content, term, page, host)
        s, e = f.bounds()
        cm = await contact_match(f)
        m = {**cm, **identified_match(s, e), 'tags': {'$nin': REG_TAGS}}
        m.pop('created_at', None)

        async def summary():
            idf_m = {**cm, **identified_match(s, e)}
            idf_m.pop('created_at', None)
            total, (last_pages, visit_counts) = await asyncio.gather(count(idf_m), abandoned_visits(m))
            n = await count(m)
            return {'identified': total, 'abandoned': n, 'abandon_rate': rate(n, total),
                    'last_pages': [{'page': x['_id'], 'count': x['n']} for x in last_pages],
                    'visits': hist([x['n'] for x in visit_counts], [0, 1, 2, 3, 4, 6, 11, 10 ** 9], ['0', '1', '2', '3', '4–5', '6–10', '11+'])}
        summ = await cached('aband|' + f.key(), 180, summary)
        find = dict(m)
        if q:
            rx = {'$regex': re.escape(q), '$options': 'i'}
            find = {'$and': [m, {'$or': [{'name': rx}, {'email': rx}, {'phone': rx}]}]}
        h = {'hint': ch(m)} if ch(m) else {}
        docs = await db.contacts.find(find, {'_id': 0, 'contact_id': 1, 'name': 1, 'email': 1, 'phone': 1, 'tags': 1,
                                             'attribution.utm_source': 1, 'attribution.utm_campaign': 1, 'attribution.utm_content': 1,
                                             'created_at': 1, 'updated_at': 1, 'first_identified_at': 1}, **h) \
            .sort('updated_at', -1).skip(offset).limit(limit).to_list(limit)
        counts = {x['_id']: x['n'] for x in await agg('page_visits', [{'$match': {'contact_id': {'$in': [d['contact_id'] for d in docs]}}},
                                                                     {'$group': {'_id': '$contact_id', 'n': {'$sum': 1}}}])}
        for d in docs:
            d['visits'] = counts.get(d['contact_id'], 0)
            a = d.pop('attribution', {}) or {}
            d['source'], d['campaign'], d['ad'] = a.get('utm_source'), a.get('utm_campaign'), a.get('utm_content')
        matching = await db.contacts.count_documents(find, **h) if q else summ['abandoned']
        return {**summ, 'matching': matching, 'offset': offset, 'people': docs}

    # ── live: the last 30 minutes ──
    @r.get('/live')
    async def live():
        async def compute():
            now = datetime.now(timezone.utc)
            since = iso(now - timedelta(minutes=30))
            minute = {'$dateToString': {'date': {'$dateTrunc': {'date': to_date('timestamp'), 'unit': 'minute'}}, 'format': '%H:%M'}}
            res = (await agg('page_visits', [{'$match': {'timestamp': {'$gte': since}}}, {'$facet': {
                'minutes': [{'$group': {'_id': minute, 'views': {'$sum': 1}, 'v': {'$addToSet': '$contact_id'}}},
                            {'$project': {'views': 1, 'visitors': {'$size': '$v'}}}, {'$sort': {'_id': 1}}],
                'active5': [{'$match': {'timestamp': {'$gte': iso(now - timedelta(minutes=5))}}}, {'$group': {'_id': '$contact_id'}}, {'$count': 'n'}],
                'active30': [{'$group': {'_id': '$contact_id'}}, {'$count': 'n'}],
                'pages': [{'$match': {'timestamp': {'$gte': iso(now - timedelta(minutes=5))}}},
                          {'$group': {'_id': PAGE, 'v': {'$addToSet': '$contact_id'}}}, {'$project': {'n': {'$size': '$v'}}},
                          {'$sort': {'n': -1}}, {'$limit': 8}],
                'sources': [{'$group': {'_id': attr_expr('utm_source'), 'v': {'$addToSet': '$contact_id'}}},
                            {'$project': {'n': {'$size': '$v'}}}, {'$sort': {'n': -1}}, {'$limit': 6}]}}]))[0]
            mins = {x['_id']: x for x in res['minutes']}
            series = []
            for i in range(29, -1, -1):
                k = (now - timedelta(minutes=i)).strftime('%H:%M')
                series.append({'minute': k, 'views': mins.get(k, {}).get('views', 0), 'visitors': mins.get(k, {}).get('visitors', 0)})
            idf = await db.contacts.count_documents({'first_identified_at': {'$gte': since}})
            regs = await db.stealth_registrations.count_documents({'registered_at': {'$gte': since}})
            return {'at': iso(now), 'active_5m': res['active5'][0]['n'] if res['active5'] else 0,
                    'active_30m': res['active30'][0]['n'] if res['active30'] else 0,
                    'identified_30m': idf, 'registrations_30m': regs, 'series': series,
                    'pages': [{'page': x['_id'], 'visitors': x['n']} for x in res['pages']],
                    'sources': [{'source': x['_id'], 'visitors': x['n']} for x in res['sources']]}
        return await cached('live', 10, compute)

    # ── dimension values for the filter pickers ──
    @r.get('/dimensions')
    async def dimensions():
        async def compute():
            out = {}
            facet = await agg('contacts', [{'$match': {'merged_into': None}}, {'$facet': {
                k: [{'$group': {'_id': f'$attribution.{field}', 'n': {'$sum': 1}}}, {'$sort': {'n': -1}}, {'$limit': 60}]
                for k, field in ATTR.items()}}])
            for k in ATTR:
                out[k] = [{'value': x['_id'] if x['_id'] not in (None, '') else '(none)', 'count': x['n']} for x in facet[0][k]]
            since = iso(datetime.now(timezone.utc) - timedelta(days=90))
            pages = await agg('page_visits', [{'$match': {'timestamp': {'$gte': since}}}, {'$group': {'_id': PAGE, 'n': {'$sum': 1}}},
                                              {'$sort': {'n': -1}}, {'$limit': 80}])
            out['page'] = [{'value': x['_id'], 'count': x['n']} for x in pages]
            hosts = {}
            for p in out['page']:
                h = p['value'].split('/')[0]
                hosts[h] = hosts.get(h, 0) + p['count']
            out['host'] = [{'value': h, 'count': n} for h, n in sorted(hosts.items(), key=lambda kv: -kv[1])]
            out['dimension_labels'] = DIM_LABELS
            out['visit_dimensions'] = sorted(VISIT_DIMS)
            out['contact_dimensions'] = sorted(CONTACT_DIMS)
            return out
        return await cached('dims', 600, compute)

    # ── saved report views (shared by everyone who uses the workspace) ──
    @r.get('/views')
    async def list_views():
        return await db.analytics_views.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)

    @r.post('/views', status_code=201)
    async def create_view(body: dict = Body(...)):
        name = str(body.get('name') or '').strip()[:80]
        params = body.get('params') or {}
        if not name or not isinstance(params, dict):
            raise HTTPException(status_code=400, detail='name and params are required')
        doc = {'id': str(uuid.uuid4()), 'name': name, 'params': {str(k)[:40]: str(v)[:500] for k, v in params.items()},
               'created_at': iso(datetime.now(timezone.utc))}
        await db.analytics_views.insert_one(dict(doc))
        return doc

    @r.delete('/views/{view_id}')
    async def delete_view(view_id: str):
        res = await db.analytics_views.delete_one({'id': view_id})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail='View not found')
        return {'status': 'deleted'}

    return r
