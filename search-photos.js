function addSearchPhoto(row,ref) {
  const source = searchPhotos[ref];
  if (source === undefined || row.classList.contains('has-search-photo')) return;
  const individual = typeof source === 'string';
  const image = document.createElement(individual ? 'img' : 'span');
  image.className = 'search-photo';
  image.setAttribute('aria-hidden','true');
  if (individual) {
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.remove(); row.classList.remove('has-search-photo'); };
    image.src = source;
  } else {
    image.style.backgroundImage = "url('assets/product-thumbnails-v1.webp')";
    image.style.backgroundPosition = (-48*(source%16))+'px '+(-48*Math.floor(source/16))+'px';
  }
  row.classList.add('has-search-photo');
  row.prepend(image);
}
function addResultPhotos() {
  document.querySelectorAll('#results .item').forEach((row,index) => {
    const product = cachedResults[index]?.p;
    if (product) addSearchPhoto(row,product[0]);
  });
}
window.addEventListener('product-results-ready',addResultPhotos);
