#!/usr/bin/env python3
"""Offline regression checks for source contracts; not a Firebase Rules emulator."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
rules=(ROOT/'firestore/firestore.rules').read_text()
html=(ROOT/'index.html').read_text()

def section(start, end):
    return rules[rules.index(start):rules.index(end, rules.index(start))]

# Student profile: create only own student; profile refresh/update cannot change role/email.
users=section('match /users/{uid}', '// Course records and lessons')
assert 'allow create: if own(uid) && validProfile(uid)' in users
assert 'allow update: if admin() || (own(uid) && validProfile(uid)' in users
assert 'request.resource.data.role == resource.data.role' in users
assert 'request.resource.data.email == resource.data.email' in users
assert 'allow delete: if admin()' in users
profile=rules[rules.index('function validProfile'):rules.index('// Self-service')]
assert "request.resource.data.role == 'student'" in profile

# Raw course records are admin-only. Public listing uses a metadata projection;
# query predicates must match the rule because Firestore rules are not filters.
courses=section('match /courses/{courseId}', 'match /publicCourses/{courseId}')
assert 'allow read, write: if admin()' in courses
public=section('match /publicCourses/{courseId}', '// Private lesson content')
assert "resource.data.status == 'published' || admin()" in public
assert 'validCourseMetadata(request.resource.data)' in public
assert 'allow create: if admin()' in public and 'allow update: if admin()' in public
assert "collection(db,'publicCourses'),where('status','==','published')" in html
assert "collection(db,'courses'),where('status','==','published')" not in html
lessons=section('match /courseLessons/{courseId}', '// A student may create')
assert 'publicCourses/$(courseId)' in rules
assert 'allow get: if admin() || (publishedCourse(courseId) && approved(courseId))' in lessons
assert 'allow list: if false' in lessons
assert 'allow create, update, delete: if admin()' in lessons

# Enrollment is deterministic, create-only for a student, pending-only; review is admin-only.
enroll=section('match /enrollments/{enrollmentId}', '// Dynamic public editorial')
for token in ['allow list: if admin()', 'allow create: if signedIn()', 'enrollmentId == request.auth.uid + \'_\' + request.resource.data.courseId', 'request.resource.data.status == \'pending\'', 'publishedCourse(request.resource.data.courseId)', 'allow update: if admin()']:
    assert token in enroll, token

# Published content/public cert verification vs private cert records; no collection browsing.
assert 'match /certificates/{code} {\n      allow read, write: if admin();' in rules
assert 'match /certificatePublic/{code}' in rules and 'allow get: if true' in rules and 'allow list: if false' in rules
assert 'match /{document=**} { allow read, write: if false; }' in rules

# Frontend writes separated records atomically; enrollment duplicate race gets server-enforced create-only.
assert "doc(db,'courseLessons',courseRef.id)" in html and 'b.commit()' in html
assert "doc(db,'enrollments',id)" in html and "status:'pending'" in html
assert 'signInWithEmailAndPassword' in html and 'createUserWithEmailAndPassword' in html
assert "setDoc(profileRef,profile)" in html and "role:'student'" in html
assert 'getDoc(doc(db,\'courseLessons\',courseId))' in html
assert 'catch(e){status(\'courseStatus\',\'Acesso às aulas indisponível.' in html
assert 'https://chatgpt.com/' in html

# Minimal policy truth-table as an independent review aid: desired allow/deny matrix.
def may_read_lesson(is_admin, published, approved):
    return is_admin or (published and approved)
assert may_read_lesson(True,False,False)
assert may_read_lesson(False,True,True)
assert not may_read_lesson(False,True,False)
assert not may_read_lesson(False,False,True)
def may_create_enrollment(is_admin, own, pending, published):
    return own and pending and published  # admin does not bypass student creation rule
assert may_create_enrollment(False,True,True,True)
assert not may_create_enrollment(False,False,True,True)
assert not may_create_enrollment(False,True,False,True)
assert not may_create_enrollment(False,True,True,False)
print('PASS: source-contract and offline policy matrix checks (NOT Firestore Emulator rules evaluation).')
