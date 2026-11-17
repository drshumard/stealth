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
SYNC_EVERY = 3 * 3600
RELOAD_EVERY = 600
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


async def load(db):
    """Reload names into memory. A name shared by several ids of the same kind gets the id's last 4 digits."""
    docs = await db.meta_names.find({}, {'kind': 1, 'name': 1}).to_list(None)
    seen = {}
    for d in docs:
        seen[(d['kind'], d['name'])] = seen.get((d['kind'], d['name']), 0) + 1
    _labels.clear()
    _labels.update({d['_id']: d['name'] if seen[(d['kind'], d['name'])] == 1 else f"{d['name']} ·{d['_id'][-4:]}" for d in docs})


async def _due(db):
    """True for exactly one worker once per SYNC_EVERY (a lease in analytics_meta)."""
    now = datetime.now(timezone.utc)
    nxt = now + timedelta(seconds=SYNC_EVERY)
    if (await db.analytics_meta.update_one({'_id': 'meta_names', 'next': {'$lt': now}}, {'$set': {'next': nxt}})).modified_count:
        return True
    try:
        await db.analytics_meta.insert_one({'_id': 'meta_names', 'next': nxt})
        return True
    except DuplicateKeyError:
        return False


async def run(db):
    """Background loop: sync when due, reload names every RELOAD_EVERY seconds."""
    if not os.environ.get('FB_ACCESS_TOKEN'):
        logger.info('meta names: FB_ACCESS_TOKEN not set — UTM values show as they are')
    while True:
        try:
            if os.environ.get('FB_ACCESS_TOKEN') and await _due(db):
                logger.info('meta names: synced %d ids', await sync(db))
            await load(db)
        except Exception as e:
            logger.warning('meta names: %s', str(e)[:300])
        await asyncio.sleep(RELOAD_EVERY)
