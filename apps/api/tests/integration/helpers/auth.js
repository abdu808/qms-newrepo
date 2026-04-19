/**
 * tests/integration/helpers/auth.js — login helper للاختبارات.
 */
import request from 'supertest';

/**
 * يسجّل الدخول ويُرجع { token, user, cookies }.
 * استعمل `token` في Authorization header: `Bearer ${token}`.
 */
export async function loginAs(app, email, password = 'Test1234!') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.token,
    user: res.body.user,
    cookies: res.headers['set-cookie'] || [],
  };
}

/**
 * يُرجع agent جاهز مع header المصادقة.
 */
export function authed(app, token) {
  return {
    get:    (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post:   (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch:  (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    put:    (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}
