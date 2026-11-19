"""Last-click attribution for analytics — an interpretation layer; the tracker and stored `attribution` are untouched.

The tracker re-sends the first ad a browser arrived from on every later visit, but every visit keeps its page address,
and a page address carrying UTMs / ad ids is a click. So for each visitor, walk their visits in time order: each visit
is credited to the most recent tagged address at or before it. Where that differs from the stored attribution, the
visit gets `lc` (the click fields to use); likewise each contact gets `lc` = their latest click. Analytics reads `lc`
when present, else `attribution`. Visitors never seen on a tagged address keep their stored attribution.

A background pass fills history once (resumable); every minute the visitors with new visits are recomputed.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl

from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger('last_click')

FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'campaign_id', 'adset_id', 'ad_id']
BATCH = 500
EVERY = 60                 # seconds between catch-up rounds
OVERLAP = 180              # a round re-reads this much before the previous one started (late writes)


def click_of(url):
    """The click fields in a page address, or None if it carries none."""
    parts = (url or '').split('#')[0].split('?', 1)
    if len(parts) < 2:
        return None
    params = dict(parse_qsl(parts[1]))
    return {f: params[f][:500] for f in FIELDS if params.get(f)} or None


def _stored(doc):
    a = doc.get('attribution') if isinstance(doc.get('attribution'), dict) else {}
    return {f: a[f] for f in FIELDS if a.get(f)}


def _op(doc, click):
    """Make doc's `lc` say `click` — or drop it when the stored attribution already says the same."""
    want = click if click and click != _stored(doc) else None
    if want == doc.get('lc'):
        return None
    return UpdateOne({'_id': doc['_id']}, {'$set': {'lc': want}} if want else {'$unset': {'lc': ''}})


async def refresh(db, contact_ids):
    """Recompute `lc` for these visitors' visits and contacts. Returns (visits changed, contacts changed)."""
    visit_ops, last, cid, current = [], {}, None, None
    async for v in db.page_visits.find({'contact_id': {'$in': contact_ids}},
                                       {'contact_id': 1, 'timestamp': 1, 'current_url': 1, 'attribution': 1, 'lc': 1}
                                       ).sort([('contact_id', 1), ('timestamp', 1)]):
        if v['contact_id'] != cid:
            cid, current = v['contact_id'], None
        current = click_of(v.get('current_url')) or current
        if current:
            last[cid] = current
        op = _op(v, current)
        if op:
            visit_ops.append(op)
    contact_ops = [op async for c in db.contacts.find({'contact_id': {'$in': contact_ids}}, {'contact_id': 1, 'attribution': 1, 'lc': 1})
                   for op in [_op(c, last.get(c['contact_id']))] if op]
    if visit_ops:
        await db.page_visits.bulk_write(visit_ops, ordered=False)
    if contact_ops:
        await db.contacts.bulk_write(contact_ops, ordered=False)
    return len(visit_ops), len(contact_ops)


async def _lease(db, job, seconds):
    """True for exactly one worker per `seconds` (a lease in analytics_meta)."""
    now = datetime.now(timezone.utc)
    if (await db.analytics_meta.update_one({'_id': job, 'next': {'$lt': now}},
                                           {'$set': {'next': now + timedelta(seconds=seconds)}})).modified_count:
        return True
    try:
        await db.analytics_meta.insert_one({'_id': job, 'next': now + timedelta(seconds=seconds)})
        return True
    except DuplicateKeyError:
        return False


async def backfill(db, pause=0.05):
    """One pass over every visitor, in contact_id order, resuming after the last finished batch. Returns totals."""
    meta = await db.analytics_meta.find_one({'_id': 'last_click_backfill'}) or {}
    if meta.get('done'):
        return None
    after = meta.get('after', '')
    ids = sorted([d['_id'] async for d in db.page_visits.aggregate([{'$group': {'_id': '$contact_id'}}], allowDiskUse=True)
                  if d['_id'] and d['_id'] > after])
    totals = [meta.get('visits', 0), meta.get('contacts', 0)]
    for i in range(0, len(ids), BATCH):
        part = ids[i:i + BATCH]
        v, c = await refresh(db, part)
        totals[0] += v
        totals[1] += c
        await db.analytics_meta.update_one({'_id': 'last_click_backfill'}, {'$set': {
            'after': part[-1], 'visits': totals[0], 'contacts': totals[1], 'at': datetime.now(timezone.utc)}}, upsert=True)
        if (i // BATCH) % 50 == 0:
            logger.info('last click backfill: %d/%d visitors, %d visits / %d contacts re-attributed', i + len(part), len(ids), *totals)
        await asyncio.sleep(pause)          # leave room for live tracking
    await db.analytics_meta.update_one({'_id': 'last_click_backfill'}, {'$set': {'done': True}}, upsert=True)
    logger.info('last click backfill done: %d visits / %d contacts re-attributed', *totals)
    return totals


async def catch_up(db):
    """Recompute the visitors with visits since the previous round."""
    now = datetime.now(timezone.utc)
    meta = await db.analytics_meta.find_one({'_id': 'last_click_watermark'}) or {}
    since = (meta.get('at') or now - timedelta(hours=1)) - timedelta(seconds=OVERLAP)
    ids = await db.page_visits.distinct('contact_id', {'timestamp': {'$gte': since.isoformat()}})
    changed = [0, 0]
    for i in range(0, len(ids), BATCH):
        v, c = await refresh(db, [x for x in ids[i:i + BATCH] if x])
        changed[0] += v
        changed[1] += c
    await db.analytics_meta.update_one({'_id': 'last_click_watermark'}, {'$set': {'at': now}}, upsert=True)
    return changed


async def run(db):
    """Background loop: keep recent visitors current every minute; fill history once (one worker each)."""
    await asyncio.sleep(20)
    backfilling = None
    while True:
        try:
            if await _lease(db, 'last_click_catch_up', EVERY - 5):
                await catch_up(db)
            # the history pass runs in its own task; a 10-minute lease (renewed while alive) keeps it on one worker
            if (backfilling is None or backfilling.done()) and await _lease(db, 'last_click_backfill_lease', 600):
                backfilling = asyncio.create_task(backfill(db))
                backfilling.add_done_callback(lambda t: t.cancelled() or not t.exception() or
                                              logger.warning('last click backfill stopped (resumes later): %s', str(t.exception())[:300]))
            elif backfilling is not None and not backfilling.done():
                await db.analytics_meta.update_one({'_id': 'last_click_backfill_lease'},
                                                   {'$set': {'next': datetime.now(timezone.utc) + timedelta(seconds=600)}})
        except Exception as e:
            logger.warning('last click: %s', str(e)[:300])
        await asyncio.sleep(EVERY)
