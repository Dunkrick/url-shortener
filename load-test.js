import http from 'k6/http';
import { check } from 'k6';

const BASE_URL =
  'https://url-shortener-902490290476.asia-south1.run.app';

http.setResponseCallback(http.expectedStatuses(302));

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const response = http.get(`${BASE_URL}/1`, {
    redirects: 0,
  });

  check(response, {
    'redirect status is 302': (r) => r.status === 302,
    'location header exists': (r) => !!r.headers.Location,
  });
}