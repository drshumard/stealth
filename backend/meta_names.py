"""Facebook ad / ad set / campaign names for UTM values that are Meta IDs (utm_content={{ad.id}} …).

Every SYNC_EVERY seconds one worker reads the ad tree of each ad account in FB_AD_ACCOUNT_ID (comma-separated) with
FB_ACCESS_TOKEN — the same non-expiring System User token analytics.drshumard.com uses — into `meta_names`; every
worker reloads that collection into memory, and analytics shows label(value) wherever it prints a UTM value.
Without the env vars nothing runs and values show as they are.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger('meta_names')

GRAPH = os.environ.get('FB_GRAPH_URL', 'https://graph.facebook.com')
VERSION = os.environ.get('FB_API_VERSION', 'v21.0')
SYNC_EVERY = 3 * 3600     # full ad tree from Facebook (~6 Graph calls)
FILL_EVERY = 300          # look up only ids seen in recent traffic that have no name yet
FILL_MAX = 25             # Graph calls per fill round, at most
MISS_RETRY = 24 * 3600    # an id Facebook could not name is asked again after this
RELOAD_EVERY = 60         # reload names from Mongo into memory (no Facebook call)
UTM_KINDS = {'utm_content': 'ad', 'utm_term': 'adset', 'utm_campaign': 'campaign'}
STATUSES = ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED',
            'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']

_labels: dict = {}   # Meta id → display name


def label(value):
    """The Meta name for an ad / ad set / campaign id; anything else unchanged."""
    return _labels.get(str(value), value)


async def sync(db):
    """Pull every ad (with its ad set and campaign) of each configured account into meta_names. Returns rows written."""
    token = os.environ.get('FB_ACCESS_TOKEN')
    accounts = [a.strip() for a in os.environ.get('FB_AD_ACCOUNT_ID', '').split(',') if a.strip()]
    if not token or not accounts:
        return 0
    now = datetime.now(timezone.utc)
    ops = {}
    async with httpx.AsyncClient(timeout=60) as c:
        for acc in accounts:
            acc = acc if acc.startswith('act_') else f'act_{acc}'
            url = f'{GRAPH}/{VERSION}/{acc}/ads'
            params = {'fields': 'id,name,adset{id,name},campaign{id,name}', 'limit': 200, 'access_token': token,
                      'filtering': json.dumps([{'field': 'effective_status', 'operator': 'IN', 'value': STATUSES}])}
            while url:
                res = await c.get(url, params=params)
                body = res.json()
                if res.status_code >= 400:
                    raise RuntimeError(f"{acc}: {(body.get('error') or {}).get('message') or res.status_code}")
                for ad in body.get('data', []):
                    for kind, e in (('ad', ad), ('adset', ad.get('adset') or {}), ('campaign', ad.get('campaign') or {})):
                        if e.get('id') and e.get('name'):
                            ops[e['id']] = UpdateOne({'_id': e['id']}, {'$set': {'kind': kind, 'name': e['name'], 'account': acc,
                                                                                 'updated_at': now}}, upsert=True)
                url, params = (body.get('paging') or {}).get('next'), None   # `next` carries every parameter
    if ops:
        await db.meta_names.bulk_write(list(ops.values()), ordered=False)
    return len(ops)


async def fill(db):
    """Name the ids in the last day's UTMs that no sync has named (an ad launched since the last sync, another account).
    One Graph call per id, at most FILL_MAX; an id Facebook can't name is stored as missing and retried after MISS_RETRY."""
    token = os.environ.get('FB_ACCESS_TOKEN')
    if not token:
        return 0
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=1)).isoformat()
    seen = {}
    for field, kind in UTM_KINDS.items():
        for v in await db.page_visits.distinct(f'attribution.{field}', {'timestamp': {'$gte': since}, f'attribution.{field}': {'$regex': r'^\d{10,}$'}}):
            seen.setdefault(v, kind)
    if not seen:
        return 0
    done = set(await db.meta_names.distinct('_id', {'_id': {'$in': list(seen)},
                                                    '$or': [{'name': {'$exists': True}}, {'missing_at': {'$gte': now - timedelta(seconds=MISS_RETRY)}}]}))
    todo = [i for i in seen if i not in done][:FILL_MAX]
    async with httpx.AsyncClient(timeout=30) as c:
        for id_ in todo:
            res = await c.get(f'{GRAPH}/{VERSION}/{id_}', params={'fields': 'name', 'access_token': token})
            name = res.json().get('name') if res.status_code < 400 else None
            upd = {'$set': {'kind': seen[id_], 'name': name, 'source': 'lookup', 'updated_at': now}} if name else \
                  {'$set': {'missing_at': now}}
            await db.meta_names.update_one({'_id': id_}, upd, upsert=True)
    return len(todo)


async def load(db):
    """Reload names into memory. A name shared by several ids of the same kind is numbered in launch order — "(1)", "(2)" —
    since Meta ids grow over time (their last digits are the same account-wide, so they can't tell copies apart)."""
    docs = await db.meta_names.find({'name': {'$exists': True}}, {'kind': 1, 'name': 1}).to_list(None)
    groups = {}
    for d in docs:
        groups.setdefault((d['kind'], d['name']), []).append(d['_id'])
    labels = {}
    for (_, name), ids in groups.items():
        ids.sort(key=lambda i: (len(i), i))
        labels.update({i: name if len(ids) == 1 else f'{name} ({n})' for n, i in enumerate(ids, 1)})
    _labels.clear()
    _labels.update(labels)


async def _due(db, job='meta_names', every=SYNC_EVERY):
    """True for exactly one worker once per `every` seconds (a lease in analytics_meta)."""
    now = datetime.now(timezone.utc)
    nxt = now + timedelta(seconds=every)
    if (await db.analytics_meta.update_one({'_id': job, 'next': {'$lt': now}}, {'$set': {'next': nxt}})).modified_count:
        return True
    try:
        await db.analytics_meta.insert_one({'_id': job, 'next': nxt})
        return True
    except DuplicateKeyError:
        return False


async def run(db):
    """Background loop: full sync every SYNC_EVERY, unknown-id fill every FILL_EVERY (one worker each), and every worker
    reloads names from Mongo every RELOAD_EVERY."""
    if not os.environ.get('FB_ACCESS_TOKEN'):
        logger.info('meta names: FB_ACCESS_TOKEN not set — UTM values show as they are')
    while True:
        try:
            if os.environ.get('FB_ACCESS_TOKEN') and await _due(db):
                logger.info('meta names: synced %d ids', await sync(db))
            if os.environ.get('FB_ACCESS_TOKEN') and await _due(db, 'meta_names_fill', FILL_EVERY):
                n = await fill(db)
                if n:
                    logger.info('meta names: looked up %d unnamed ids', n)
            await load(db)
        except Exception as e:
            logger.warning('meta names: %s', str(e)[:300])
        await asyncio.sleep(RELOAD_EVERY)
