import json
import sys
from pathlib import Path
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
root = Path(__file__).parent / 'samples'
session = requests.Session()
queries = [
    {'label': 'recent_gcov', 'params': {'dataset': 'NISAR', 'processingLevel': 'GCOV', 'start': '2026-01-01T00:00:00Z', 'end': '2026-11-11T23:59:59Z', 'maxResults': 3, 'output': 'geojson'}},
    {'label': 'mozambique_january', 'params': {'dataset': 'NISAR', 'processingLevel': 'GCOV', 'bbox': '32.5,-25.7,33.7,-24.2', 'start': '2026-01-01T00:00:00Z', 'end': '2026-01-20T23:59:59Z', 'maxResults': 30, 'output': 'geojson'}},
    {'label': 'mozambique_provisional', 'params': {'dataset': 'NISAR', 'processingLevel': 'GCOV', 'bbox': '32.5,-25.7,33.7,-24.2', 'start': '2026-06-17T00:00:00Z', 'end': '2026-11-11T23:59:59Z', 'dataMaturity': 'PROVISIONAL', 'maxResults': 6, 'output': 'geojson'}},
    {'label': 'mozambique_validated', 'params': {'dataset': 'NISAR', 'processingLevel': 'GCOV', 'bbox': '32.5,-25.7,33.7,-24.2', 'start': '2026-10-21T00:00:00Z', 'end': '2026-11-11T23:59:59Z', 'dataMaturity': 'VALIDATED', 'maxResults': 8, 'output': 'geojson'}},
]
for query in queries:
    if len(sys.argv) > 1 and query['label'] != sys.argv[1]:
        continue
    try:
        response = session.get('https://api.daac.asf.alaska.edu/services/search/param', params=query['params'], timeout=40, verify=False)
        print(json.dumps({'label': query['label'], 'status': response.status_code, 'url': response.url, 'bytes': len(response.content)}))
        if not response.ok:
            print(response.text[:1500])
            continue
        data = response.json()
        (root / ('nisar-' + query['label'] + '.json')).write_text(json.dumps(data, indent=2), encoding='utf-8')
        features = data.get('features', [])
        summary = []
        for item in features:
            props = item.get('properties', {})
            summary.append({key: props.get(key) for key in ['startTime', 'pathNumber', 'frameNumber', 'collectionName', 'crid', 'fileName', 'url']})
            summary[-1]['bytes'] = props.get('bytes', {}).get(props.get('fileName'), {}).get('bytes')
        print(json.dumps({'count': len(features), 'features': summary}, ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'label': query['label'], 'error': str(error)}))

saved = root / 'nisar-mozambique_january.json'
if saved.exists():
    catalogue = json.loads(saved.read_text(encoding='utf-8'))
    checks = []
    for feature in catalogue['features']:
        props = feature['properties']
        if props.get('frameNumber') != 166:
            continue
        # Inspect public response headers only. No authentication is attempted.
        with session.get(props['url'], headers={'Range': 'bytes=0-7'}, stream=True, allow_redirects=False, timeout=25, verify=False) as response:
            check = {'file': props['fileName'], 'status': response.status_code, 'content_type': response.headers.get('Content-Type'), 'redirect_host': requests.utils.urlparse(response.headers.get('Location', '')).netloc}
            checks.append(check)
            print(json.dumps(check))
    (root / 'nisar-download-access-checks.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
