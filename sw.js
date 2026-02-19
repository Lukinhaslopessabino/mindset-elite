self.addEventListener('install', e=>{
e.waitUntil(
caches.open('mindset-cache').then(cache=>{
return cache.addAll([
'/',
'/index.html',
'/manifest.json'
]);
})
);
});
