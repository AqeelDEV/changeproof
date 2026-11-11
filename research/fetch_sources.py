import concurrent.futures
import json
import pathlib
import sys
import urllib.parse

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ROOT = pathlib.Path(__file__).parent / 'sources'
ROOT.mkdir(exist_ok=True)

def fetch(url):
    try:
        response = requests.get(url, timeout=35, verify=False)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        for element in soup(['script', 'style', 'nav', 'footer', 'header']):
            element.decompose()
        main = soup.body or soup
        text = main.get_text('\n', strip=True)
        links = [{'text': a.get_text(' ', strip=True), 'url': urllib.parse.urljoin(url, a['href'])} for a in main.find_all('a', href=True)]
        result = {'url': url, 'status': response.status_code, 'text': text, 'links': links}
        slug = urllib.parse.urlparse(url).path.strip('/').replace('/', '__') or urllib.parse.urlparse(url).netloc
        (ROOT / (slug + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        return result
    except Exception as error:
        return {'url': url, 'error': str(error)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for item in pool.map(fetch, sys.argv[1:]):
        print(json.dumps(item, ensure_ascii=True))
