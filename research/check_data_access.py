import concurrent.futures
import json
import pathlib
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
root = pathlib.Path(__file__).parent / 'samples'
root.mkdir(exist_ok=True)
items = [
    ('dubai-power-monthly.json', 'https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,RH2M&community=AG&longitude=55.2708&latitude=25.2048&start=2001&end=2025&format=JSON'),
    ('same-particle-results.pdf', 'https://ntrs.nasa.gov/api/citations/20130000422/downloads/20130000422.pdf'),
    ('smoke-detector-reference.pdf', 'https://ntrs.nasa.gov/api/citations/20205003817/downloads/ICES_Final_340.pdf'),
    ('portugal-modis-2023.csv', 'https://firms.modaps.eosdis.nasa.gov/data/country/modis/2023/modis_2023_Portugal.csv'),
    ('portugal-viirs-2023.csv', 'https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2023/viirs-snpp_2023_Portugal.csv'),
    ('donki-sep-2024-may.json', 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31'),
]

def check(item):
    name, url = item
    try:
        response = requests.get(url, timeout=40, verify=False)
        result = {'name': name, 'url': url, 'status': response.status_code, 'bytes': len(response.content), 'type': response.headers.get('Content-Type')}
        if response.status_code == 200:
            if name.endswith('.pdf'):
                result['valid_signature'] = response.content.startswith(b'%PDF-')
            elif name.endswith('.json'):
                data = response.json()
                result['shape'] = len(data)
                if 'properties' in data:
                    result['sources'] = data.get('header')
                    result['parameters'] = data.get('parameters')
                    result['counts'] = {k: len(v) for k,v in data['properties']['parameter'].items()}
            elif name.endswith('.csv'):
                result['header'] = response.text.splitlines()[0]
                result['rows'] = len(response.text.splitlines()) - 1
            (root / name).write_bytes(response.content)
        return result
    except Exception as error:
        return {'name':name, 'url':url, 'error':str(error)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(check, items))
(root / 'access-checks.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
for result in results:
    print(json.dumps(result))
