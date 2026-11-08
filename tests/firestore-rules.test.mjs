import { readFileSync } from 'node:fs';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const projectId = 'demo-analista-rules-test';
let env;
const published = { title: 'Hematologia', description: 'Curso de teste', duration: '4 semanas', status: 'published', createdBy: 'admin', createdAt: new Date(), updatedAt: new Date() };
const draft = { ...published, title: 'Rascunho', status: 'draft' };
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin'), { name: 'Admin', email: 'admin@example.com', role: 'admin', createdAt: new Date() });
    await setDoc(doc(db, 'publicCourses/course1'), published);
    await setDoc(doc(db, 'publicCourses/draft1'), draft);
    await setDoc(doc(db, 'courseLessons/course1'), { lessonText: 'Aula privada' });
    await setDoc(doc(db, 'certificates/private1'), { studentName: 'Estudante' });
    await setDoc(doc(db, 'certificatePublic/PUBLIC1'), { studentName: 'Estudante', courseTitle: 'Hematologia' });
    await setDoc(doc(db, 'enrollments/student1_course1'), { studentId: 'student1', studentEmail: 'student@example.com', studentName: 'Aluno', courseId: 'course1', status: 'pending', createdAt: new Date() });
  });
});
after(async () => env.cleanup());

test('público consulta cursos publicados; rascunhos continuam privados', async () => {
  const db = env.unauthenticatedContext().firestore();
  const q = query(collection(db, 'publicCourses'), where('status', '==', 'published'));
  const result = await assertSucceeds(getDocs(q));
  assert.equal(result.size, 1);
  await assertFails(getDoc(doc(db, 'publicCourses/draft1')));
});
test('aluno cria perfil próprio, mas não pode promover-se a admin', async () => {
  const db = env.authenticatedContext('student1', { email: 'student@example.com' }).firestore();
  await assertSucceeds(setDoc(doc(db, 'users/student1'), { name: 'Aluno', email: 'student@example.com', role: 'student', createdAt: new Date() }));
  await assertFails(updateDoc(doc(db, 'users/student1'), { role: 'admin' }));
});
test('inscrição própria pendente permitida; forjar identidade ou estado é negado', async () => {
  const db = env.authenticatedContext('student2', { email: 'student2@example.com' }).firestore();
  const base = { studentId: 'student2', studentEmail: 'student2@example.com', studentName: 'Aluno 2', courseId: 'course1', status: 'pending', createdAt: new Date() };
  await assertSucceeds(setDoc(doc(db, 'enrollments/student2_course1'), base));
  await assertFails(setDoc(doc(db, 'enrollments/student3_course1'), { ...base, studentId: 'student3' }));
  await assertFails(setDoc(doc(db, 'enrollments/student2_draft1'), { ...base, courseId: 'draft1' }));
  await assertFails(updateDoc(doc(db, 'enrollments/student2_course1'), { status: 'approved' }));
});
test('aula negada antes da aprovação e autorizada após admin aprovar; outro aluno negado', async () => {
  const student = env.authenticatedContext('student1', { email: 'student@example.com' }).firestore();
  await assertFails(getDoc(doc(student, 'courseLessons/course1')));
  const admin = env.authenticatedContext('admin', { email: 'admin@example.com' }).firestore();
  await assertSucceeds(updateDoc(doc(admin, 'enrollments/student1_course1'), { status: 'approved' }));
  await assertSucceeds(getDoc(doc(student, 'courseLessons/course1')));
  const other = env.authenticatedContext('student2', { email: 'student2@example.com' }).firestore();
  await assertFails(getDoc(doc(other, 'courseLessons/course1')));
});
test('aluno não lista inscrições; certificado público só por código; certificado privado negado', async () => {
  const db = env.authenticatedContext('student1', { email: 'student@example.com' }).firestore();
  await assertFails(getDocs(collection(db, 'enrollments')));
  await assertFails(getDoc(doc(db, 'certificates/private1')));
  const publicDb = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, 'certificatePublic/PUBLIC1')));
  await assertFails(getDocs(collection(publicDb, 'certificatePublic')));
});
test('admin pode gerir curso e aprovar inscrições', async () => {
  const db = env.authenticatedContext('admin', { email: 'admin@example.com' }).firestore();
  await assertSucceeds(setDoc(doc(db, 'publicCourses/new'), { ...published, createdBy: 'admin' }));
  await assertSucceeds(updateDoc(doc(db, 'enrollments/student1_course1'), { status: 'approved' }));
});
