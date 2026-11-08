#!/usr/bin/env python3
"""Static validation for the repaired standalone site (tree-sitter-javascript optional)."""
from pathlib import Path
from html.parser import HTMLParser
import re, sys
ROOT=Path(__file__).resolve().parents[1]
class IDs(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.links=[]; self.scripts=[]; self.assets=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag=='a': self.links.append(a.get('href',''))
        if tag=='script': self.scripts.append(a)
        if tag=='img': self.assets.append(a.get('src',''))

def parse(name):
    p=ROOT/name; parser=IDs(); parser.feed(p.read_text(encoding='utf8')); return parser
up=parse('reference/upstream-index.html'); fixed=parse('index.html')
assert len(fixed.ids)==len(set(fixed.ids)), 'Duplicate DOM IDs'
assert set(up.ids)-{'contentImageFile'}==set(fixed.ids), 'Unexpected original section/form IDs changed'
assert 'contentImageFile' in set(up.ids)-set(fixed.ids), 'R2 upload control should remain explicitly disabled until secure integration'
assert 'https://chatgpt.com/' in fixed.links, 'Existing ChatGPT link missing'
for section in ['inicio','sobre','artigos','analises','biblioteca','educacao','noticias','galeria','cursos','plataforma','certificados','contactos']:
    assert section in fixed.ids, f'Missing original section: {section}'
for img in ['bioquimica-clinica.jpg','coproparasitologia.jpg','hematologia.jpg','imunohematologia.jpg','microbiologia.jpg','urinologia.jpg']:
    assert (ROOT/img).is_file() and (ROOT/img).stat().st_size>1000, f'Image asset missing/empty: {img}'
html=(ROOT/'index.html').read_text(encoding='utf8')
for token in ['courseLessons','writeBatch','enrollments','signupBtn','signInWithEmailAndPassword','sendPasswordResetEmail','certificatePublic','https://chatgpt.com/']:
    assert token in html, f'Missing feature marker {token}'
for forbidden in ['getStorage(', 'firebase-storage.js','contentImageFile','const data=await r.json()']:
    assert forbidden not in html, f'Removed/dangling feature still present: {forbidden}'
rules=(ROOT/'firestore/firestore.rules').read_text()
for snippet in ['rules_version = \'2\'', 'match /courseLessons/{courseId}', 'approved(courseId)', "request.resource.data.role == 'student'", "request.resource.data.status == 'pending'", 'match /{document=**} { allow read, write: if false; }']:
    assert snippet in rules, f'Rules safety marker missing: {snippet}'
# JS parser check when installed (supports both module and classic script syntax).
try:
    from bs4 import BeautifulSoup
    from tree_sitter import Language, Parser
    import tree_sitter_javascript
except ImportError:
    print('SKIP: install beautifulsoup4 tree-sitter tree-sitter-javascript for JS grammar check')
else:
    soup=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf8'),'html.parser')
    parser=Parser(Language(tree_sitter_javascript.language()))
    for n,s in enumerate(soup.find_all('script')):
        src=(s.string or s.get_text()).encode()
        tree=parser.parse(src)
        assert not tree.root_node.has_error, f'JavaScript syntax error in inline script #{n}'
print('PASS: static portal checks; upstream IDs and ChatGPT link preserved, assets present, rules/privacy markers present.')
