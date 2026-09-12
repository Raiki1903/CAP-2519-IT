import http from 'http';

http.get('http://127.0.0.1:4000/api/analytics/dashboard', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Body:', data.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
